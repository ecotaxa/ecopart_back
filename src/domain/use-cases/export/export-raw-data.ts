import path from "path";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import archiver from "archiver";

import { UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";

import { UserRepository } from "../../interfaces/repositories/user-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { ExportRawDataRequestModel, ExportRawDataUseCase, RawExportType } from "../../interfaces/use-cases/export/export-raw-data";

const EXPORT_TYPES: RawExportType[] = ["metadata", "lpm", "ctd", "ecotaxa"];

export class ExportRawData implements ExportRawDataUseCase {
    constructor(
        private userRepository: UserRepository,
        private privilegeRepository: PrivilegeRepository,
        private projectRepository: ProjectRepository,
        private sampleRepository: SampleRepository,
        private taskRepository: TaskRepository,
        private ecotaxaAccountRepository: EcotaxaAccountRepository,
        private DATA_STORAGE_FOLDER: string,
        private base_url_path: string,
    ) { }

    async execute(current_user: UserUpdateModel, request: ExportRawDataRequestModel): Promise<TaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const { sample_ids, export_types } = this.validateRequest(request);
        const ecotaxa_exclude_not_living = !!request.ecotaxa_exclude_not_living;

        // Resolve samples + projects, then authorize each distinct project.
        const samples = await this.sampleRepository.getSamplesByIds(sample_ids);
        if (samples.length === 0) throw new Error("No samples found");
        const found_ids = new Set(samples.map(s => s.sample_id));
        const missing = sample_ids.filter(id => !found_ids.has(id));
        if (missing.length > 0) throw new Error(`Sample(s) not found: ${missing.join(", ")}`);

        const project_ids = Array.from(new Set(samples.map(s => s.project_id)));
        const projects_by_id = new Map<number, ProjectResponseModel>();
        for (const project_id of project_ids) {
            await this.ensureUserCanAccess(current_user, project_id);
            const project = await this.projectRepository.getProject({ project_id });
            if (!project) throw new Error("Cannot find project");
            projects_by_id.set(project_id, project);
        }

        const task_id = await this.taskRepository.createTask({
            task_type: TaskType.Export_Raw,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            // Cross-project export: keep task_project_id unset.
            task_params: { sample_ids, export_types, ecotaxa_exclude_not_living },
        } as PublicTaskRequestCreationModel);

        const task = await this.taskRepository.getOneTask({ task_id });
        if (!task) throw new Error("Cannot find task");

        // Fire-and-forget — the route returns the task immediately and the frontend polls.
        this.runExport(task, samples, projects_by_id, export_types, ecotaxa_exclude_not_living);

        return task;
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

    private async ensureUserCanAccess(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        if (userIsAdmin) return;
        const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
        if (!userHasPrivilege) throw new Error(`Logged user cannot export raw data from project ${project_id}`);
    }

    private async runExport(
        task: TaskResponseModel,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
        export_types: RawExportType[],
        ecotaxa_exclude_not_living: boolean,
    ): Promise<void> {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id });

            const base_folder = path.join(__dirname, "..", "..", "..", "..");
            const task_folder = path.join(base_folder, this.DATA_STORAGE_FOLDER, "tasks", `${task_id}`);
            const work_folder = path.join(task_folder, "raw_export");
            await fsPromises.mkdir(work_folder, { recursive: true });

            const step_count = export_types.length;
            let step_index = 0;
            const progressFor = (step_done: number) => Math.min(95, Math.round(5 + (step_done / step_count) * 90));

            for (const export_type of export_types) {
                step_index += 1;
                await this.taskRepository.updateTaskProgress({ task_id }, progressFor(step_index - 1), `Step ${step_index}/${step_count} ${export_type}: start`);

                if (export_type === "metadata") {
                    await this.writeMetadata(work_folder, samples, projects_by_id);
                } else if (export_type === "lpm") {
                    await this.writeLpm(task, work_folder, samples, projects_by_id);
                } else if (export_type === "ctd") {
                    await this.writeCtd(task, work_folder, samples, projects_by_id);
                } else if (export_type === "ecotaxa") {
                    await this.writeEcotaxa(task, work_folder, samples, projects_by_id, ecotaxa_exclude_not_living);
                }

                await this.taskRepository.updateTaskProgress({ task_id }, progressFor(step_index), `Step ${step_index}/${step_count} ${export_type}: done`);
            }

            const zip_file_name = `ecopart_export_raw_${task_id}.zip`;
            const zip_path = path.join(task_folder, zip_file_name);
            await this.zipFolder(work_folder, zip_path);
            await fsPromises.rm(work_folder, { recursive: true, force: true });

            const download_link = `${this.base_url_path}/api/tasks/${task_id}/file`;
            await this.taskRepository.logMessage(task.task_log_file_path, `Exported at: ${zip_path}`);
            await this.taskRepository.logMessage(task.task_log_file_path, `Download link: ${download_link}`);
            await this.taskRepository.finishTask({ task_id }, download_link);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }

    private async writeMetadata(
        work_folder: string,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
    ): Promise<void> {
        const dir = path.join(work_folder, "metadata");
        await fsPromises.mkdir(dir, { recursive: true });

        const projects = Array.from(projects_by_id.values());
        const project_csv = this.toCsv(projects);
        await fsPromises.writeFile(path.join(dir, "projects.csv"), project_csv);

        const sample_csv = this.toCsv(samples);
        await fsPromises.writeFile(path.join(dir, "samples.csv"), sample_csv);
    }

    private async writeLpm(
        task: TaskResponseModel,
        work_folder: string,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
    ): Promise<void> {
        for (const sample of samples) {
            const project = projects_by_id.get(sample.project_id);
            if (!project) continue;
            const files = await this.sampleRepository.listLpmRawFilesForSample(project.instrument_model, project.project_id, sample.sample_name);
            if (files.length === 0) {
                await this.taskRepository.logMessage(task.task_log_file_path, `LPM: no raw files found for sample '${sample.sample_name}' (project ${project.project_id}, instrument ${project.instrument_model})`);
                continue;
            }
            const dest_dir = path.join(work_folder, "lpm", `${project.project_id}`, sample.sample_name);
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
        const by_project = new Map<number, { project: ProjectResponseModel; sample_names: string[] }>();
        for (const sample of samples) {
            const project = projects_by_id.get(sample.project_id);
            if (!project) continue;
            if (!project.ecotaxa_project_id) {
                await this.taskRepository.logMessage(task.task_log_file_path, `EcoTaxa: skipping sample '${sample.sample_name}' (project ${project.project_id} has no linked EcoTaxa project)`);
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

    private toCsv(rows: { [key: string]: any }[]): string {
        if (rows.length === 0) return "";
        const headers = Array.from(rows.reduce<Set<string>>((acc, row) => {
            Object.keys(row).forEach(k => acc.add(k));
            return acc;
        }, new Set()));
        const escape = (v: any): string => {
            if (v === null || v === undefined) return "";
            const s = typeof v === "string" ? v : JSON.stringify(v);
            if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
        };
        const lines = [headers.join(",")];
        for (const row of rows) {
            lines.push(headers.map(h => escape(row[h])).join(","));
        }
        return lines.join("\n") + "\n";
    }

    private zipFolder(folder_path: string, zip_file_path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zip_file_path);
            const archive = archiver("zip", { zlib: { level: 9 } });
            output.on("close", () => resolve());
            archive.on("error", reject);
            archive.pipe(output);
            archive.directory(folder_path, false);
            archive.finalize();
        });
    }
}
