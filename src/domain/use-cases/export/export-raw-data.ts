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
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { ExportRawDataRequestModel, ExportRawDataUseCase, RawExportType } from "../../interfaces/use-cases/export/export-raw-data";
import { computeProjectPrivacy } from "./project-privacy";
import { renderReadme } from "./readme";
import { MinimalUserModel } from "../../entities/user";

const EXPORT_TYPES: RawExportType[] = ["metadata", "lpm", "ctd", "ecotaxa"];

const PROJECT_TSV_COLUMNS: string[] = [
    "ecopart_project_id",
    "ecopart_project_title",
    "project_total_samples",
    "project_total_samples_exported",
    "ecotaxa_instance_url",
    "ecotaxa_project_id",
    "ecotaxa_project_title",
    "project_total_ecotaxa_samples",
    "project_total_ecotaxa_samples_exported",
    "project_acronym",
    "project_description",
    "project_cruise_wmo",
    "project_ship_floatref",
    "project_data_owner_name",
    "project_data_owner_email",
    "project_operator_name",
    "project_operator_email",
    "project_chief_scientist_name",
    "project_chief_scientist_email",
    "project_instrument",
    "project_instrument_model_name",
    "project_instrument_serial_number",
    "project_override_depth_offset",
    "project_enable_descent_filter",
    "project_creation_utc_date_time",
    "project_export_utc_date_time",
    "project_privacy",
    "project_privacy_delay",
    "project_general_download_delay",
    "project_ecotaxa_classification_download_delay",
    "project_managers",
    "project_members",
];

const SAMPLE_TSV_COLUMNS: string[] = [
    "ecopart_project_id",
    "ecopart_sample_id",
    "sample_name",
    "sample_comment",
    "sample_type",
    "sampling_utc_date_time",
    "sample_import_utc_date_time",
    "sample_max_pressure",
    "station_id",
    "sample_latitude",
    "sample_longitude",
    "environment_wind_direction",
    "environment_sea_state",
    "environment_bottom_depth",
    "environment_wind_speed",
    "environment_nebulousness",
    "instrument_operator_email",
    "ecotaxa_sample_imported",
    "ecotaxa_sample_import_utc_date_time",
    "ecotaxa_sample_id",
    "ecotaxa_sample_tsv_file_name",
    "ecotaxa_sample_nb_images",
    "ecotaxa_import_status_id",
    "ecotaxa_import_status_label",
    "ecotaxa_sample_task_id",
    "instrument_settings_serial_number",
    "instrument_settings_aa",
    "instrument_settings_exp",
    "instrument_settings_image_volume_l",
    "instrument_settings_pixel_size_mm",
    "instrument_settings_depth_offset_m",
    "instrument_settings_acq_pressure_gain",
    "instrument_settings_particule_minimum_area_pixels",
    "instrument_settings_vignette_minimum_area_pixels",
    "instrument_settings_acq_shutter_speed",
    "instrument_settings_acq_gain",
    "instrument_settings_acq_x_size",
    "instrument_settings_acq_y_size",
    "instrument_settings_acq_description",
    "instrument_settings_acq_choice",
    "instrument_settings_acq_disk_type",
    "instrument_settings_acq_threshold",
    "instrument_settings_acq_exposure",
    "instrument_settings_acq_erase_border",
    "instrument_settings_acq_task_type",
    "instrument_settings_acq_vignette_roi_enlargement_ratio",
    "instrument_settings_process_gamma",
    "instrument_settings_process_vignette_resize_factor",
    "instrument_settings_process_datetime",
    "instrument_settings_images_post_process",
    "sample_integration_time",
    "filename",
    "filter_first_image",
    "filter_last_image",
    "ctd_original_file_name",
    "ctd_imported_file_name",
    "ctd_importator_name",
    "ctd_importator_email",
    "ctd_import_utc_date_time",
    "ctd_latitude",
    "ctd_longitude",
    "visual_qc_status",
    "visual_qc_validator_email",
    "number_of_black",
];

// Replace tab/CR/LF in a TSV cell with a single space so the row stays parseable; no quoting.
function tsvSanitize(value: string): string {
    return value.replace(/[\t\r\n]+/g, " ");
}

function serialize(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    return tsvSanitize(String(value));
}

function serializeUserList(users: MinimalUserModel[]): string {
    return users.map(u => `${u.user_name} <${u.email}>`).join("; ");
}

function toIso(date_string: string): string {
    const d = new Date(date_string);
    return Number.isNaN(d.getTime()) ? date_string : d.toISOString();
}

function toTsv(headers: string[], rows: Record<string, string>[]): string {
    if (headers.length === 0) return "";
    const lines = [headers.join("\t")];
    for (const row of rows) {
        lines.push(headers.map(h => row[h] ?? "").join("\t"));
    }
    return lines.join("\n") + "\n";
}

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
        const export_started_at = new Date();
        this.runExport(task, samples, projects_by_id, export_types, ecotaxa_exclude_not_living, export_started_at);

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
        export_started_at: Date,
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
                    await this.writeMetadata(work_folder, samples, projects_by_id, export_started_at, export_types);
                } else if (export_type === "lpm") {
                    await this.writeLpm(task, work_folder, samples, projects_by_id);
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
        export_started_at: Date,
        export_types: RawExportType[],
    ): Promise<void> {
        const dir = path.join(work_folder, "metadata");
        await fsPromises.mkdir(dir, { recursive: true });

        const project_ids = Array.from(projects_by_id.keys());
        const samples_per_project_total = await this.sampleRepository.countSamplesPerProject(project_ids);
        const ecotaxa_samples_per_project_total = await this.sampleRepository.countEcotaxaSamplesPerProject(project_ids);
        const exported_per_project = new Map<number, number>();
        // `project_total_ecotaxa_samples_exported` reflects what was truly added to the EcoTaxa
        // section of this export. It stays 0 when ecotaxa isn't in `export_types`, and
        // otherwise uses the same per-sample predicate as `writeEcotaxa` (sample is in basket,
        // its project has a linked EcoTaxa project, and the sample is flagged
        // `ecotaxa_sample_imported`). Keep this filter in sync with `writeEcotaxa`.
        const ecotaxa_exported_per_project = new Map<number, number>();
        for (const project_id of project_ids) {
            exported_per_project.set(project_id, 0);
            ecotaxa_exported_per_project.set(project_id, 0);
        }
        const ecotaxa_in_export = export_types.includes("ecotaxa");
        for (const sample of samples) {
            exported_per_project.set(sample.project_id, (exported_per_project.get(sample.project_id) ?? 0) + 1);
            if (ecotaxa_in_export && sample.ecotaxa_sample_imported && projects_by_id.get(sample.project_id)?.ecotaxa_project_id) {
                ecotaxa_exported_per_project.set(sample.project_id, (ecotaxa_exported_per_project.get(sample.project_id) ?? 0) + 1);
            }
        }

        const project_rows: Record<string, string>[] = [];
        for (const project of projects_by_id.values()) {
            const ecotaxa_instance_url = await this.resolveEcotaxaInstanceUrl(project.ecotaxa_instance_id);
            const bodc = await this.resolveInstrumentBodc(project.instrument_model);
            const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: project.project_id });
            const managers = privileges?.managers ?? [];
            const members = privileges?.members ?? [];
            project_rows.push({
                ecopart_project_id: serialize(project.project_id),
                ecopart_project_title: serialize(project.project_title),
                ecotaxa_instance_url: serialize(ecotaxa_instance_url),
                ecotaxa_project_id: serialize(project.ecotaxa_project_id),
                ecotaxa_project_title: serialize(project.ecotaxa_project_name),
                project_total_samples: serialize(samples_per_project_total.get(project.project_id) ?? 0),
                project_total_samples_exported: serialize(exported_per_project.get(project.project_id) ?? 0),
                project_total_ecotaxa_samples: serialize(ecotaxa_samples_per_project_total.get(project.project_id) ?? 0),
                project_total_ecotaxa_samples_exported: serialize(ecotaxa_exported_per_project.get(project.project_id) ?? 0),
                project_acronym: serialize(project.project_acronym),
                project_description: serialize(project.project_description),
                project_cruise_wmo: serialize(project.cruise),
                project_ship_floatref: serialize(project.ship),
                project_data_owner_name: serialize(project.data_owner_name),
                project_data_owner_email: serialize(project.data_owner_email),
                project_operator_name: serialize(project.operator_name),
                project_operator_email: serialize(project.operator_email),
                project_chief_scientist_name: serialize(project.chief_scientist_name),
                project_chief_scientist_email: serialize(project.chief_scientist_email),
                project_instrument: serialize(bodc),
                project_instrument_model_name: serialize(project.instrument_model),
                project_instrument_serial_number: serialize(project.serial_number),
                project_override_depth_offset: serialize(project.override_depth_offset),
                project_enable_descent_filter: serialize(project.enable_descent_filter),
                project_creation_utc_date_time: serialize(toIso(project.project_creation_utc_date_time)),
                project_export_utc_date_time: export_started_at.toISOString(),
                project_privacy: computeProjectPrivacy(
                    project.project_creation_utc_date_time,
                    project.privacy_duration,
                    project.visible_duration,
                    project.public_duration,
                    export_started_at,
                ),
                project_privacy_delay: serialize(project.privacy_duration),
                project_general_download_delay: serialize(project.visible_duration),
                project_ecotaxa_classification_download_delay: serialize(project.public_duration),
                project_managers: serializeUserList(managers),
                project_members: serializeUserList(members),
            });
        }

        await fsPromises.writeFile(path.join(dir, "projects.tsv"), toTsv(PROJECT_TSV_COLUMNS, project_rows));

        // Stable, reproducible row order: by (ecopart_project_id, ecopart_sample_id).
        const ordered_samples = [...samples].sort((a, b) =>
            a.project_id - b.project_id || a.sample_id - b.sample_id);

        const sample_rows: Record<string, string>[] = ordered_samples.map(sample => ({
            ecopart_project_id: serialize(sample.project_id),
            ecopart_sample_id: serialize(sample.sample_id),
            sample_name: serialize(sample.sample_name),
            sample_comment: serialize(sample.comment),
            sample_type: serialize(sample.sample_type_label),
            sampling_utc_date_time: serialize(toIso(sample.sampling_utc_date_time)),
            sample_import_utc_date_time: serialize(toIso(sample.sample_creation_utc_date_time)),
            sample_max_pressure: serialize(sample.max_pressure),
            station_id: serialize(sample.station_id),
            sample_latitude: serialize(sample.latitude),
            sample_longitude: serialize(sample.longitude),
            environment_wind_direction: serialize(sample.wind_direction),
            environment_sea_state: serialize(sample.sea_state),
            environment_bottom_depth: serialize(sample.bottom_depth),
            environment_wind_speed: serialize(sample.wind_speed),
            environment_nebulousness: serialize(sample.nebulousness),
            instrument_operator_email: serialize(sample.instrument_operator_email),
            ecotaxa_sample_imported: serialize(sample.ecotaxa_sample_imported),
            ecotaxa_sample_import_utc_date_time: serialize(sample.ecotaxa_sample_import_utc_date_time ? toIso(sample.ecotaxa_sample_import_utc_date_time) : null),
            ecotaxa_sample_id: serialize(sample.ecotaxa_sample_id),
            ecotaxa_sample_tsv_file_name: serialize(sample.ecotaxa_sample_tsv_file_name),
            ecotaxa_sample_nb_images: serialize(sample.ecotaxa_sample_nb_images),
            ecotaxa_import_status_id: serialize(sample.ecotaxa_import_status_id),
            ecotaxa_import_status_label: serialize(sample.ecotaxa_import_status_label),
            ecotaxa_sample_task_id: serialize(sample.ecotaxa_sample_task_id),
            instrument_settings_serial_number: serialize(sample.instrument_serial_number),
            instrument_settings_aa: serialize(sample.instrument_settings_aa),
            instrument_settings_exp: serialize(sample.instrument_settings_exp),
            instrument_settings_image_volume_l: serialize(sample.instrument_settings_image_volume_l),
            instrument_settings_pixel_size_mm: serialize(sample.instrument_settings_pixel_size_mm),
            instrument_settings_depth_offset_m: serialize(sample.instrument_settings_depth_offset_m),
            instrument_settings_acq_pressure_gain: serialize(sample.instrument_settings_acq_pressure_gain),
            instrument_settings_particule_minimum_area_pixels: serialize(sample.instrument_settings_particule_minimum_area_pixels),
            instrument_settings_vignette_minimum_area_pixels: serialize(sample.instrument_settings_vignette_minimum_area_pixels),
            instrument_settings_acq_shutter_speed: serialize(sample.instrument_settings_acq_shutter_speed),
            instrument_settings_acq_gain: serialize(sample.instrument_settings_acq_gain),
            instrument_settings_acq_x_size: serialize(sample.instrument_settings_acq_x_size),
            instrument_settings_acq_y_size: serialize(sample.instrument_settings_acq_y_size),
            instrument_settings_acq_description: serialize(sample.instrument_settings_acq_description),
            instrument_settings_acq_choice: serialize(sample.instrument_settings_acq_choice),
            instrument_settings_acq_disk_type: serialize(sample.instrument_settings_acq_disk_type),
            instrument_settings_acq_threshold: serialize(sample.instrument_settings_acq_threshold),
            instrument_settings_acq_exposure: serialize(sample.instrument_settings_acq_exposure),
            instrument_settings_acq_erase_border: serialize(sample.instrument_settings_acq_erase_border),
            instrument_settings_acq_task_type: serialize(sample.instrument_settings_acq_task_type),
            instrument_settings_acq_vignette_roi_enlargement_ratio: serialize(sample.instrument_settings_acq_vignette_roi_enlargement_ratio),
            instrument_settings_process_gamma: serialize(sample.instrument_settings_process_gamma),
            instrument_settings_process_vignette_resize_factor: serialize(sample.instrument_settings_process_vignette_resize_factor),
            instrument_settings_process_datetime: serialize(sample.instrument_settings_process_datetime),
            instrument_settings_images_post_process: serialize(sample.instrument_settings_images_post_process),
            sample_integration_time: serialize(sample.instrument_settings_integration_time),
            filename: serialize(sample.filename),
            filter_first_image: serialize(sample.filter_first_image),
            filter_last_image: serialize(sample.filter_last_image),
            ctd_original_file_name: serialize(sample.ctd_original_file_name),
            ctd_imported_file_name: serialize(sample.ctd_imported_file_name),
            ctd_importator_name: serialize(sample.ctd_importator_name),
            ctd_importator_email: serialize(sample.ctd_importator_email),
            ctd_import_utc_date_time: serialize(sample.ctd_import_utc_date_time ? toIso(sample.ctd_import_utc_date_time) : null),
            ctd_latitude: serialize(sample.ctd_latitude),
            ctd_longitude: serialize(sample.ctd_longitude),
            visual_qc_status: serialize(sample.visual_qc_status_label),
            visual_qc_validator_email: serialize(sample.visual_qc_validator_email),
            number_of_black: serialize(sample.nb_black),
        }));

        await fsPromises.writeFile(path.join(dir, "samples.tsv"), toTsv(SAMPLE_TSV_COLUMNS, sample_rows));
    }

    private async resolveEcotaxaInstanceUrl(ecotaxa_instance_id: number | null): Promise<string | null> {
        if (!ecotaxa_instance_id) return null;
        const instance = await this.ecotaxaAccountRepository.getOneEcoTaxaInstance(ecotaxa_instance_id);
        return instance?.ecotaxa_instance_url ?? null;
    }

    private async resolveInstrumentBodc(instrument_model_name: string): Promise<string | null> {
        if (!instrument_model_name) return null;
        const instrument = await this.instrumentModelRepository.getOneInstrumentModel({ instrument_model_name });
        return instrument?.bodc_url ?? null;
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
