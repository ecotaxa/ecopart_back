import path from "path";
import * as fsPromises from "fs/promises";

import { UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel, RawFileCategory } from "../../entities/sample";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";

import { UserRepository } from "../../interfaces/repositories/user-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { ExportRawDataRequestModel, ExportRawDataUseCase, RawExportType } from "../../interfaces/use-cases/export/export-raw-data";
import { renderReadme } from "./readme";
import { ExportMetadataWriter } from "./export-metadata";
import { zipFolder } from "./zip-folder";
import { removeExportWorkFolder } from "./work-folder";
import { ProjectAccessPolicy } from "../project/project-access";

const EXPORT_TYPES: RawExportType[] = ["metadata", "lpm", "images", "instrument_config", "ctd", "ecotaxa"];

// The three artifact-copying steps: each export type maps to one category of stored artifact and
// one folder of the archive. `warn_when_empty` is false for the categories that are legitimately
// absent (no vignettes imported, UVP6 has no separate config archive) so the task log only reports
// what actually looks like a problem.
const ARTIFACT_STEPS: Record<"lpm" | "images" | "instrument_config", { category: RawFileCategory; folder: string; label: string; warn_when_empty: boolean }> = {
    lpm: { category: "lpm", folder: "lpm", label: "LPM", warn_when_empty: true },
    images: { category: "images", folder: "images", label: "Images", warn_when_empty: false },
    instrument_config: { category: "instrument_config", folder: "instrument_config", label: "Instrument config", warn_when_empty: false },
};

export class ExportRawData implements ExportRawDataUseCase {
    constructor(
        private userRepository: UserRepository,
        private privilegeRepository: PrivilegeRepository,
        private projectRepository: ProjectRepository,
        private sampleRepository: SampleRepository,
        private taskRepository: TaskRepository,
        private ecotaxaAccountRepository: EcotaxaAccountRepository,
        private instrumentModelRepository: InstrumentModelRepository,
        private DATA_STORAGE_FOLDER: string,
        private base_url_path: string,
    ) { }

    private readonly metadataWriter = new ExportMetadataWriter(this.sampleRepository, this.privilegeRepository, this.taskRepository, this.ecotaxaAccountRepository, this.instrumentModelRepository);
    private readonly access = new ProjectAccessPolicy(this.userRepository, this.privilegeRepository);

    async execute(current_user: UserUpdateModel, request: ExportRawDataRequestModel): Promise<PublicTaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const { sample_ids, export_types } = this.validateRequest(request);
        const ecotaxa_exclude_not_living = !!request.ecotaxa_exclude_not_living;
        const skip_not_validated = !!request.skip_not_validated;

        // Resolve samples + projects, then authorize each distinct project.
        const all_samples = await this.sampleRepository.getSamplesByIds(sample_ids);
        if (all_samples.length === 0) throw new Error("No samples found");
        const found_ids = new Set(all_samples.map(s => s.sample_id));
        const missing = sample_ids.filter(id => !found_ids.has(id));
        if (missing.length > 0) throw new Error(`Sample(s) not found: ${missing.join(", ")}`);

        // Authorization first, per distinct project of the requested samples, so that the QC gate
        // below never names samples the caller may not see.
        const projects_by_id = new Map<number, ProjectResponseModel>();
        for (const project_id of Array.from(new Set(all_samples.map(s => s.project_id)))) {
            const project = await this.projectRepository.getProject({ project_id });
            if (!project) throw new Error("Cannot find project");
            await this.ensureUserCanAccess(current_user, project);
            projects_by_id.set(project_id, project);
        }

        // QC gate: only visual-QC-validated samples may be exported. By default a single
        // non-validated sample aborts the whole export; with `skip_not_validated` the caller accepts
        // a partial archive instead — the dropped samples are then named in the task log. Either way
        // an export with nothing left to ship is refused with the same error, so the route still
        // answers 409 and the caller learns which samples are at fault.
        const not_validated = all_samples.filter(s => s.visual_qc_status_label !== "VALIDATED");
        const skipped_not_validated = not_validated.map(s => `${s.sample_name} (${s.visual_qc_status_label})`);
        if (not_validated.length > 0 && !skip_not_validated) {
            throw new Error(`Sample(s) not validated: ${not_validated.map(s => s.sample_name).join(", ")}`);
        }
        const samples = skip_not_validated
            ? all_samples.filter(s => s.visual_qc_status_label === "VALIDATED")
            : all_samples;
        if (samples.length === 0) {
            throw new Error(`Sample(s) not validated: ${not_validated.map(s => s.sample_name).join(", ")}`);
        }

        const task_id = await this.taskRepository.createTask({
            task_type: TaskType.Export_Raw,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            // Cross-project export: keep task_project_id unset.
            task_params: { sample_ids, export_types, ecotaxa_exclude_not_living, skip_not_validated },
        } as PublicTaskRequestCreationModel);

        const task = await this.taskRepository.getOneTask({ task_id });
        if (!task) throw new Error("Cannot find task");

        // Fire-and-forget — the route returns the task immediately and the frontend polls.
        const export_started_at = new Date();
        this.runExport(task, samples, projects_by_id, export_types, ecotaxa_exclude_not_living, export_started_at, skipped_not_validated);

        return this.taskRepository.toPublicTask(task);
    }

    private validateRequest(request: ExportRawDataRequestModel): { sample_ids: number[]; export_types: RawExportType[] } {
        if (!Array.isArray(request.sample_ids) || request.sample_ids.length === 0) {
            throw new Error("sample_ids must be a non-empty array");
        }
        const sample_ids = request.sample_ids.map(Number);
        if (sample_ids.some(n => !Number.isInteger(n) || n <= 0)) {
            throw new Error("sample_ids must be positive integers");
        }
        if (!Array.isArray(request.export_types) || request.export_types.length === 0) {
            throw new Error("export_types must be a non-empty array");
        }
        const export_types: RawExportType[] = [];
        for (const t of request.export_types) {
            if (!EXPORT_TYPES.includes(t)) throw new Error(`Unknown export type: ${t}`);
            if (!export_types.includes(t)) export_types.push(t);
        }
        return { sample_ids, export_types };
    }

    // The raw export is the archive recovery (product 3): it gives back the files the members
    // imported, so it stays with admins, members and managers whatever the project's privacy.
    private async ensureUserCanAccess(current_user: UserUpdateModel, project: ProjectResponseModel): Promise<void> {
        if (await this.access.can(current_user.user_id, project, "export_archive")) return;
        throw new Error(`Logged user cannot export raw data from project ${project.project_id}`);
    }

    private async runExport(
        task: TaskResponseModel,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
        export_types: RawExportType[],
        ecotaxa_exclude_not_living: boolean,
        export_started_at: Date,
        skipped_not_validated: string[],
    ): Promise<void> {
        const task_id = task.task_id;

        // Computed before the try so the failure path can remove exactly what this task produced.
        const base_folder = path.join(__dirname, "..", "..", "..", "..");
        const task_folder = path.join(base_folder, this.DATA_STORAGE_FOLDER, "tasks", `${task_id}`);
        const work_folder = path.join(task_folder, "raw_export");
        const zip_path = path.join(task_folder, `ecopart_export_raw_${task_id}.zip`);
        // Only a folder this run actually created may be removed on failure: the paths above are
        // computed, not observed, and must never drive a deletion on their own.
        let work_folder_created = false;

        try {
            await this.taskRepository.startTask({ task_id });

            // Traceability of a partial export: the archive itself only holds validated samples, so
            // the task log is the only place stating what the caller asked for and did not get.
            if (skipped_not_validated.length > 0) {
                await this.taskRepository.logMessage(task.task_log_file_path,
                    `QC: ${skipped_not_validated.length} sample(s) excluded from this export because they are not VALIDATED: ${skipped_not_validated.join(", ")}`);
            }

            await fsPromises.mkdir(work_folder, { recursive: true });
            work_folder_created = true;

            const step_count = export_types.length;
            let step_index = 0;
            const progressFor = (step_done: number) => Math.min(95, Math.round(5 + (step_done / step_count) * 90));

            for (const export_type of export_types) {
                await this.taskRepository.throwIfCancelled(task_id);
                step_index += 1;
                await this.taskRepository.updateTaskProgress({ task_id }, progressFor(step_index - 1), `Step ${step_index}/${step_count} ${export_type}: start`);

                if (export_type === "metadata") {
                    await this.metadataWriter.write(task, path.join(work_folder, "metadata"), samples, projects_by_id, export_started_at, export_types.includes("ecotaxa"));
                } else if (export_type === "lpm" || export_type === "images" || export_type === "instrument_config") {
                    await this.writeArtifacts(task, work_folder, samples, projects_by_id, ARTIFACT_STEPS[export_type]);
                } else if (export_type === "ctd") {
                    await this.writeCtd(task, work_folder, samples, projects_by_id);
                } else if (export_type === "ecotaxa") {
                    await this.writeEcotaxa(task, work_folder, samples, projects_by_id, ecotaxa_exclude_not_living);
                }

                await this.taskRepository.updateTaskProgress({ task_id }, progressFor(step_index), `Step ${step_index}/${step_count} ${export_type}: done`);
            }

            // Consumer-facing documentation, generated from the same column constants the
            // emitters use — so the README can't drift from the actual file contents.
            await fsPromises.writeFile(path.join(work_folder, "README.md"), renderReadme(export_types));

            await this.taskRepository.throwIfCancelled(task_id);
            await zipFolder(work_folder, zip_path);
            await fsPromises.rm(work_folder, { recursive: true, force: true });

            const download_link = `${this.base_url_path}/api/tasks/${task_id}/file`;
            await this.taskRepository.logMessage(task.task_log_file_path, `Exported at: ${zip_path}`);
            await this.taskRepository.logMessage(task.task_log_file_path, `Download link: ${download_link}`);
            await this.taskRepository.finishTask({ task_id }, download_link);
        } catch (error) {
            if (work_folder_created) await removeExportWorkFolder(this.taskRepository, task, work_folder, error);
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }

    // Copies one category of stored per-sample artifact into `<category folder>/<project_id>/<sample_name>/`.
    // Shared by the `lpm`, `images` and `instrument_config` steps: only the source category, the
    // destination folder and the "is an empty result worth a warning" policy differ.
    //
    // TODO(camille): the artifacts are copied verbatim from import, so their own header values still
    // hold the original acquisition values and can disagree with what `metadata/samples.tsv` exports
    // for the same sample (re-processed lat/long, ISO-normalised dates, serial number rewritten to
    // the per-instrument convention…). These headers must be rewritten at export time so data and
    // metadata agree. Blocked on Camille: get the meaning of every header field before touching them.
    //
    // TODO: the project's descent filter (`project.enable_descent_filter`) is NOT applied to the
    // exported data either, so consumers get the ascent images EcoPart itself discards and will not
    // recompute EcoPart's abundances. The algorithm already exists as pure logic —
    // `buildImageFiltering` in use-cases/sample/qc-graphs-builder.ts — but its outcome (removed
    // count, last image actually used) is not persisted: `filter_last_image` is the raw header
    // value. Applying it means producing derived files, hence the dependency on the TODO above.
    // See docs/export-raw-todo.md section E.
    private async writeArtifacts(
        task: TaskResponseModel,
        work_folder: string,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
        step: { category: RawFileCategory; folder: string; label: string; warn_when_empty: boolean },
    ): Promise<void> {
        for (const sample of samples) {
            const project = projects_by_id.get(sample.project_id);
            if (!project) continue;
            const files = await this.sampleRepository.listRawFilesForSample(project.instrument_model, project.project_id, sample.sample_name, step.category);
            if (files.length === 0) {
                if (step.warn_when_empty) {
                    await this.taskRepository.logMessage(task.task_log_file_path, `${step.label}: no raw files found for sample '${sample.sample_name}' (project ${project.project_id}, instrument ${project.instrument_model})`);
                } else {
                    await this.taskRepository.logMessage(task.task_log_file_path, `${step.label}: nothing to export for sample '${sample.sample_name}' (instrument ${project.instrument_model})`);
                }
                continue;
            }
            const dest_dir = path.join(work_folder, step.folder, `${project.project_id}`, sample.sample_name);
            await fsPromises.mkdir(dest_dir, { recursive: true });
            for (const src of files) {
                await fsPromises.copyFile(src, path.join(dest_dir, path.basename(src)));
            }
        }
    }

    private async writeCtd(
        task: TaskResponseModel,
        work_folder: string,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
    ): Promise<void> {
        for (const sample of samples) {
            if (!sample.ctd_imported) {
                await this.taskRepository.logMessage(task.task_log_file_path, `CTD: skipping sample '${sample.sample_name}' (no CTD imported)`);
                continue;
            }
            const project = projects_by_id.get(sample.project_id);
            if (!project) continue;
            const extension = sample.ctd_file_extension || "ctd";
            const src = this.sampleRepository.getCTDFileAbsolutePath(project.project_id, sample.sample_name, extension);
            try {
                await fsPromises.access(src);
            } catch {
                await this.taskRepository.logMessage(task.task_log_file_path, `CTD: file not found on disk for sample '${sample.sample_name}': ${src}`);
                continue;
            }
            const dest_dir = path.join(work_folder, "ctd", `${project.project_id}`);
            await fsPromises.mkdir(dest_dir, { recursive: true });
            await fsPromises.copyFile(src, path.join(dest_dir, `${sample.sample_name}.${extension}`));
        }
    }

    private async writeEcotaxa(
        task: TaskResponseModel,
        work_folder: string,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
        exclude_not_living: boolean,
    ): Promise<void> {
        // Group sample names by EcoTaxa-linked project, then run one export per project.
        // The per-sample predicate here is the source of truth for what gets counted in
        // `project_total_ecotaxa_samples_exported` — keep `writeMetadata` in sync.
        const by_project = new Map<number, { project: ProjectResponseModel; sample_names: string[] }>();
        for (const sample of samples) {
            const project = projects_by_id.get(sample.project_id);
            if (!project) continue;
            if (!project.ecotaxa_project_id) {
                await this.taskRepository.logMessage(task.task_log_file_path, `EcoTaxa: skipping sample '${sample.sample_name}' (project ${project.project_id} has no linked EcoTaxa project)`);
                continue;
            }
            if (!sample.ecotaxa_sample_imported) {
                await this.taskRepository.logMessage(task.task_log_file_path, `EcoTaxa: skipping sample '${sample.sample_name}' (not imported into EcoTaxa)`);
                continue;
            }
            const entry = by_project.get(project.project_id) ?? { project, sample_names: [] };
            entry.sample_names.push(sample.sample_name);
            by_project.set(project.project_id, entry);
        }

        for (const { project, sample_names } of by_project.values()) {
            const dest_dir = path.join(work_folder, "ecotaxa", `${project.project_id}`);
            await fsPromises.mkdir(dest_dir, { recursive: true });
            const dest_file = path.join(dest_dir, `ecotaxa_export_${project.project_id}.zip`);
            try {
                await this.ecotaxaAccountRepository.exportObjectSetGeneral(project, sample_names, exclude_not_living, dest_file);
            } catch (err) {
                await this.taskRepository.logMessage(task.task_log_file_path, `EcoTaxa: export failed for project ${project.project_id}: ${(err as Error).message}`);
                throw err;
            }
        }
    }
}
