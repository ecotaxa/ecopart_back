import path from "path";
import * as fsPromises from "fs/promises";

import { UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { BinnedExportBinMode } from "../../entities/binned-export";
import { BINNED_DEPTH_STEP_M, BINNED_TIME_STEP_H } from "../../constants/binned-export";
import { DEFAULT_EXPORT_TABLE_FORMAT, EXPORT_TABLE_FORMATS } from "../../constants/export-format";
import { ExportTableFormat } from "../../entities/export";

import { UserRepository } from "../../interfaces/repositories/user-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { ExportBinnedDataRequestModel, ExportBinnedDataUseCase } from "../../interfaces/use-cases/export/export-binned-data";
import { BinAxis, BinnedSampleBuilder, BinnedSampleSettings, exportedSizeClasses, formatNumber, particleCells, particleTableColumns, sampleVisibleSizeClasses } from "./binned-computation";
import { renderBinnedReadme } from "./binned-readme";
import { ExportMetadataWriter } from "./export-metadata";
import { ProjectAccessPolicy } from "../project/project-access";
import { zipFolder } from "./zip-folder";
import { removeExportWorkFolder } from "./work-folder";
import { openTableWriter, TableWriter } from "./table";

const BIN_MODES: BinnedExportBinMode[] = ["auto", "depth", "time"];
// The particle table is appended this many rows at a time, so a long sample never sits whole in memory.
const ROWS_PER_WRITE = 1000;

interface BinnedExportPlan {
    sample_ids: number[];
    bin_mode: BinnedExportBinMode;
    depth_step_m: number;
    time_step_h: number;
    format: ExportTableFormat;
}

/* Binned export (product 1), first version: particles only, computed on the fly from each sample's
 * UVP6-format pivot in an export task, bins of a uniform step. Decisions of 12 October 2026 in
 * docs/export-products-and-uvp6-pivot.md. */
export class ExportBinnedData implements ExportBinnedDataUseCase {
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

    async execute(current_user: UserUpdateModel, request: ExportBinnedDataRequestModel): Promise<PublicTaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const plan = this.validateRequest(request);
        const skip_not_validated = !!request.skip_not_validated;

        const all_samples = await this.sampleRepository.getSamplesByIds(plan.sample_ids);
        if (all_samples.length === 0) throw new Error("No samples found");
        const found_ids = new Set(all_samples.map(s => s.sample_id));
        const missing = plan.sample_ids.filter(id => !found_ids.has(id));
        if (missing.length > 0) throw new Error(`Sample(s) not found: ${missing.join(", ")}`);

        // Authorization first, so that the QC gate below never names samples the caller may not see.
        const export_started_at = new Date();
        const projects_by_id = new Map<number, ProjectResponseModel>();
        for (const project_id of Array.from(new Set(all_samples.map(s => s.project_id)))) {
            const project = await this.projectRepository.getProject({ project_id });
            if (!project) throw new Error("Cannot find project");
            await this.ensureUserCanExport(current_user, project, export_started_at);
            projects_by_id.set(project_id, project);
        }

        // Same visual-QC gate as the raw export.
        const not_validated = all_samples.filter(s => s.visual_qc_status_label !== "VALIDATED");
        const skipped_not_validated = not_validated.map(s => `${s.sample_name} (${s.visual_qc_status_label})`);
        if (not_validated.length > 0 && !skip_not_validated) {
            throw new Error(`Sample(s) not validated: ${not_validated.map(s => s.sample_name).join(", ")}`);
        }
        const samples = all_samples
            .filter(s => s.visual_qc_status_label === "VALIDATED")
            .sort((a, b) => a.project_id - b.project_id || a.sample_id - b.sample_id);
        if (samples.length === 0) {
            throw new Error(`Sample(s) not validated: ${not_validated.map(s => s.sample_name).join(", ")}`);
        }
        const exported_projects = new Map(samples.map(s => [s.project_id, projects_by_id.get(s.project_id) as ProjectResponseModel]));

        // A sample that cannot be binned is reported before any task exists, all of them at once.
        await this.ensureSamplesCanBeBinned(samples, exported_projects);

        const task_id = await this.taskRepository.createTask({
            task_type: TaskType.Export,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            // Cross-project export: keep task_project_id unset.
            task_params: { sample_ids: plan.sample_ids, bin_mode: plan.bin_mode, bin_size_m: plan.depth_step_m, bin_size_h: plan.time_step_h, skip_not_validated, format: plan.format },
        } as PublicTaskRequestCreationModel);

        const task = await this.taskRepository.getOneTask({ task_id });
        if (!task) throw new Error("Cannot find task");

        // Fire-and-forget: the route returns the task immediately and the frontend polls. runExport
        // records its own failures; only a failure to record one (the task deleted meanwhile, the
        // database unavailable) reaches this catch, which keeps it from stopping the server.
        this.runExport(task, samples, exported_projects, plan, export_started_at, skipped_not_validated)
            .catch((error) => console.log(new Date().toISOString(), `Binned export task ${task.task_id} could not record its outcome`, error));

        return this.taskRepository.toPublicTask(task);
    }

    private validateRequest(request: ExportBinnedDataRequestModel): BinnedExportPlan {
        if (!Array.isArray(request.sample_ids) || request.sample_ids.length === 0) {
            throw new Error("sample_ids must be a non-empty array");
        }
        const sample_ids = request.sample_ids.map(Number);
        if (sample_ids.some(n => !Number.isInteger(n) || n <= 0)) {
            throw new Error("sample_ids must be positive integers");
        }
        const bin_mode = request.bin_mode ?? "auto";
        if (!BIN_MODES.includes(bin_mode)) {
            throw new Error(`bin_mode must be one of: ${BIN_MODES.join(", ")}`);
        }
        const format = request.format ?? DEFAULT_EXPORT_TABLE_FORMAT;
        if (!EXPORT_TABLE_FORMATS.includes(format)) {
            throw new Error(`format must be one of: ${EXPORT_TABLE_FORMATS.join(", ")}`);
        }
        const step = (value: number | null | undefined, bounds: { default: number; min: number; max: number }, name: string): number => {
            if (value === undefined || value === null) return bounds.default;
            const n = Number(value);
            if (!Number.isFinite(n) || n < bounds.min || n > bounds.max) throw new Error(`${name} must be between ${bounds.min} and ${bounds.max}`);
            return n;
        };
        return {
            sample_ids,
            bin_mode,
            depth_step_m: step(request.bin_size_m, BINNED_DEPTH_STEP_M, "bin_size_m"),
            time_step_h: step(request.bin_size_h, BINNED_TIME_STEP_H, "bin_size_h"),
            format,
        };
    }

    // Who may export follows the project's privacy (M11, matrix of the original spec): admins, and
    // the project's members and managers, always; any other registered user once the project is
    // public or open.
    private async ensureUserCanExport(current_user: UserUpdateModel, project: ProjectResponseModel, now: Date): Promise<void> {
        if (await this.access.can(current_user.user_id, project, "export_particles", now)) return;
        throw new Error(`Logged user cannot export binned data from project ${project.project_id}`);
    }

    private async ensureSamplesCanBeBinned(samples: PublicSampleModel[], projects_by_id: Map<number, ProjectResponseModel>): Promise<void> {
        const unsupported: string[] = [];
        const uncalibrated: string[] = [];
        const without_pivot: string[] = [];
        for (const sample of samples) {
            const instrument_model = (projects_by_id.get(sample.project_id) as ProjectResponseModel).instrument_model;
            if (!instrument_model.startsWith("UVP5") && !instrument_model.startsWith("UVP6")) {
                unsupported.push(`${sample.sample_name} (${instrument_model})`);
                continue;
            }
            const missing_settings = [
                ...(sample.instrument_settings_aa > 0 ? [] : ["aa"]),
                ...(sample.instrument_settings_exp > 0 ? [] : ["exp"]),
                ...(sample.instrument_settings_image_volume_l > 0 ? [] : ["image volume"]),
            ];
            if (missing_settings.length > 0) uncalibrated.push(`${sample.sample_name} (${missing_settings.join(", ")})`);
            if (instrument_model.startsWith("UVP5") && await this.sampleRepository.getPivotConverterVersion(sample.project_id, sample.sample_name) === null) {
                without_pivot.push(sample.sample_name);
            }
        }
        if (unsupported.length > 0) throw new Error(`Instrument not supported by the binned export: ${unsupported.join(", ")}`);
        if (uncalibrated.length > 0) throw new Error(`Sample(s) without calibration: ${uncalibrated.join(", ")}`);
        if (without_pivot.length > 0) throw new Error(`Sample(s) without pivot: ${without_pivot.join(", ")}. Run the pivot regeneration of their project.`);
    }

    private settingsOf(sample: PublicSampleModel, project: ProjectResponseModel): BinnedSampleSettings {
        return {
            sample_name: sample.sample_name,
            instrument_model: project.instrument_model,
            is_depth_profile: sample.sample_type_label === "Depth",
            descent_filter_enabled: project.enable_descent_filter,
            filter_first_image: sample.filter_first_image ?? null,
            filter_last_image: sample.filter_last_image ?? null,
            depth_offset_m: project.override_depth_offset ?? sample.instrument_settings_depth_offset_m ?? null,
            image_volume_l: sample.instrument_settings_image_volume_l,
            aa: sample.instrument_settings_aa,
            exp: sample.instrument_settings_exp,
            particle_minimum_area_px: sample.instrument_settings_particule_minimum_area_pixels ?? null,
        };
    }

    private axisOf(sample: PublicSampleModel, bin_mode: BinnedExportBinMode): BinAxis {
        if (bin_mode !== "auto") return bin_mode;
        return sample.sample_type_label === "Depth" ? "depth" : "time";
    }

    private async runExport(
        task: TaskResponseModel,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
        plan: BinnedExportPlan,
        export_started_at: Date,
        skipped_not_validated: string[],
    ): Promise<void> {
        const task_id = task.task_id;

        // Computed before the try so the failure path can remove exactly what this task produced.
        const base_folder = path.join(__dirname, "..", "..", "..", "..");
        const task_folder = path.join(base_folder, this.DATA_STORAGE_FOLDER, "tasks", `${task_id}`);
        const work_folder = path.join(task_folder, "binned_export");
        const zip_path = path.join(task_folder, `ecopart_export_binned_${task_id}.zip`);
        // Only a folder this run actually created may be removed on failure.
        let work_folder_created = false;
        let particles: TableWriter | null = null;

        try {
            await this.taskRepository.startTask({ task_id });
            if (skipped_not_validated.length > 0) {
                await this.taskRepository.logMessage(task.task_log_file_path,
                    `QC: ${skipped_not_validated.length} sample(s) excluded from this export because they are not VALIDATED: ${skipped_not_validated.join(", ")}`);
            }

            await fsPromises.mkdir(work_folder, { recursive: true });
            work_folder_created = true;

            // The columns only depend on each sample's calibration, so they are known before any
            // file is read and the rows can be written sample by sample.
            const settings_by_id = new Map(samples.map(s => [s.sample_id, this.settingsOf(s, projects_by_id.get(s.project_id) as ProjectResponseModel)]));
            const class_indexes = exportedSizeClasses(samples.map(s => sampleVisibleSizeClasses(settings_by_id.get(s.sample_id) as BinnedSampleSettings)));

            await this.taskRepository.throwIfCancelled(task_id);
            await this.taskRepository.updateTaskProgress({ task_id }, 5, "Step 1/2 metadata: start");
            await this.metadataWriter.write(task, path.join(work_folder, "metadata"), samples, projects_by_id, export_started_at, false, plan.format);
            await this.taskRepository.updateTaskProgress({ task_id }, 15, "Step 1/2 metadata: done");

            const particles_writer = await openTableWriter(plan.format, path.join(work_folder, "particles"), particleTableColumns(class_indexes), { formatNumber });
            particles = particles_writer;
            const particles_file = path.basename(particles_writer.file_path);
            for (const [i, sample] of samples.entries()) {
                await this.taskRepository.throwIfCancelled(task_id);
                const settings = settings_by_id.get(sample.sample_id) as BinnedSampleSettings;
                const axis = this.axisOf(sample, plan.bin_mode);
                const step = axis === "depth" ? plan.depth_step_m : plan.time_step_h;
                // Two passes over the pivot (see BinnedSampleBuilder): no sample is held whole in memory.
                const pivot = await this.sampleRepository.getPivotImages(sample.project_id, sample.sample_name, settings.instrument_model);
                const builder = new BinnedSampleBuilder(settings, pivot.columns, { axis, step });
                for await (const record of pivot.rows()) builder.add(record);
                const binned = builder.finish();
                for (let start = 0; start < binned.bins.length; start += ROWS_PER_WRITE) {
                    await particles_writer.append(binned.bins.slice(start, start + ROWS_PER_WRITE).map(bin => particleCells(sample.sample_id, binned, bin, class_indexes)));
                }

                const summary = `${sample.sample_name}: ${binned.bins.length} ${axis} bin(s) of ${step} ${axis === "depth" ? "m" : "h"} from ${binned.used_images} image(s) used`;
                await this.taskRepository.updateTaskProgress({ task_id }, 15 + Math.round(((i + 1) / samples.length) * 75), `Step 2/2 particles: ${summary}`);
                if (binned.bins.length === 0) {
                    const position = axis === "depth" ? "pressure" : "readable time";
                    const positions = axis === "depth" ? pivot.columns.raw_pressure : pivot.columns.image_time_ms;
                    const placeable = positions.some(position => !Number.isNaN(position));
                    const reason = pivot.columns.length === 0 ? "its particle file holds no image"
                        : !placeable ? `none of its images has a ${position}`
                            : binned.used_images === 0 ? "no image is left after the operator window and the descent filter"
                                : `none of its ${binned.used_images} image(s) used has a ${position}`;
                    await this.taskRepository.logMessage(task.task_log_file_path, `${sample.sample_name}: ${reason}, the sample has no row in ${particles_file}`);
                }
                if (binned.particles_below_minimum_area > 0) {
                    await this.taskRepository.logMessage(task.task_log_file_path,
                        `${sample.sample_name}: ${binned.particles_below_minimum_area} particle(s) smaller than the minimum area of ${binned.minimum_area_px} px are left out of the counts`);
                }
            }

            await particles_writer.close();
            particles = null;

            await fsPromises.writeFile(path.join(work_folder, "README.md"), renderBinnedReadme({
                format: plan.format,
                bin_mode: plan.bin_mode,
                depth_step_m: plan.depth_step_m,
                time_step_h: plan.time_step_h,
                class_indexes,
            }));

            await this.taskRepository.throwIfCancelled(task_id);
            await zipFolder(work_folder, zip_path);
            await fsPromises.rm(work_folder, { recursive: true, force: true });

            const download_link = `${this.base_url_path}/api/tasks/${task_id}/file`;
            await this.taskRepository.logMessage(task.task_log_file_path, `Exported at: ${zip_path}`);
            await this.taskRepository.logMessage(task.task_log_file_path, `Download link: ${download_link}`);
            await this.taskRepository.finishTask({ task_id }, download_link);
        } catch (error) {
            // The particle file goes with the working folder: its handle must not outlive it.
            if (particles) await particles.close().catch(() => undefined);
            if (work_folder_created) await removeExportWorkFolder(this.taskRepository, task, work_folder, error);
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }
}
