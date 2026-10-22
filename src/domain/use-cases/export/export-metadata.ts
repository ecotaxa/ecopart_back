import path from "path";
import * as fsPromises from "fs/promises";

import { MinimalUserModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { TaskResponseModel } from "../../entities/task";
import { ImageFilteringMetadata } from "../../entities/sample-qc-graph";

import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { buildImageFilteringMetadata } from "../sample/qc-graphs-builder";
import { computeProjectPrivacy } from "../../utils/project-privacy";
import { serialize, toIso, toTsv } from "./tsv";

// `metadata/projects.tsv` and `metadata/samples.tsv`, identical in every export product: the raw
// export and the binned export both write them with this writer.

export const PROJECT_TSV_COLUMNS: string[] = [
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

export const SAMPLE_TSV_COLUMNS: string[] = [
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
    "instrument_settings_process_utc_date_time",
    "instrument_settings_images_post_process",
    "sample_integration_time",
    "filename",
    "filter_first_image",
    "filter_last_image",
    "filter_last_image_used",
    "filter_removed_images_count",
    "filter_removed_images_percent",
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

function serializeUserList(users: MinimalUserModel[]): string {
    return users.map(u => `${u.user_name} <${u.email}>`).join("; ");
}

export class ExportMetadataWriter {
    constructor(
        private sampleRepository: SampleRepository,
        private privilegeRepository: PrivilegeRepository,
        private taskRepository: TaskRepository,
        private ecotaxaAccountRepository: EcotaxaAccountRepository,
        private instrumentModelRepository: InstrumentModelRepository,
    ) { }

    // Writes `projects.tsv` and `samples.tsv` into `dir`. `ecotaxa_in_export` tells whether the
    // export also ships EcoTaxa data, which `project_total_ecotaxa_samples_exported` counts.
    async write(
        task: TaskResponseModel,
        dir: string,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
        export_started_at: Date,
        ecotaxa_in_export: boolean,
    ): Promise<void> {
        await fsPromises.mkdir(dir, { recursive: true });

        const project_ids = Array.from(projects_by_id.keys());
        const samples_per_project_total = await this.sampleRepository.countSamplesPerProject(project_ids);
        const ecotaxa_samples_per_project_total = await this.sampleRepository.countEcotaxaSamplesPerProject(project_ids);
        const exported_per_project = new Map<number, number>();
        // `project_total_ecotaxa_samples_exported` reflects what was truly added to the EcoTaxa
        // section of this export. It stays 0 when the export ships no EcoTaxa data, and
        // otherwise uses the same per-sample predicate as the raw export's `writeEcotaxa` (sample
        // is in basket, its project has a linked EcoTaxa project, and the sample is flagged
        // `ecotaxa_sample_imported`). Keep this filter in sync with `writeEcotaxa`.
        const ecotaxa_exported_per_project = new Map<number, number>();
        for (const project_id of project_ids) {
            exported_per_project.set(project_id, 0);
            ecotaxa_exported_per_project.set(project_id, 0);
        }
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

        const filtering_by_sample_id = await this.computeImageFiltering(task, ordered_samples, projects_by_id);

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
            instrument_settings_process_utc_date_time: serialize(sample.instrument_settings_process_datetime),
            instrument_settings_images_post_process: serialize(sample.instrument_settings_images_post_process),
            sample_integration_time: serialize(sample.instrument_settings_integration_time),
            filename: serialize(sample.filename),
            filter_first_image: serialize(sample.filter_first_image),
            filter_last_image: serialize(sample.filter_last_image),
            filter_last_image_used: serialize(filtering_by_sample_id.get(sample.sample_id)?.last_image_used),
            filter_removed_images_count: serialize(filtering_by_sample_id.get(sample.sample_id)?.removed_images.count),
            filter_removed_images_percent: serialize(filtering_by_sample_id.get(sample.sample_id)?.removed_images.percent),
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

    /* Descent-filter outcome per sample, replayed at export time from the stored per-image records
     * with the very same logic the QC graphs use (`buildImageFilteringMetadata`), and honouring the
     * project's `enable_descent_filter`. Nothing is persisted at import, so this is recomputed on
     * every export — it re-reads each sample's particle file, hence the per-sample error handling:
     * a sample whose data cannot be read is reported in the task log and leaves the three
     * `filter_*_used/removed` cells empty rather than failing the whole export.
     *
     * Note: this only *reports* the filter. The files the raw export copies are still unfiltered
     * — see the TODO on its writeArtifacts. */
    private async computeImageFiltering(
        task: TaskResponseModel,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
    ): Promise<Map<number, ImageFilteringMetadata>> {
        const by_sample_id = new Map<number, ImageFilteringMetadata>();
        for (const sample of samples) {
            const project = projects_by_id.get(sample.project_id);
            if (!project) continue;
            try {
                const records = await this.sampleRepository.getPerImageRecords(sample.project_id, sample.sample_name, project.instrument_model);
                by_sample_id.set(sample.sample_id, buildImageFilteringMetadata({
                    sample_id: sample.sample_id,
                    sample_name: sample.sample_name,
                    instrument_model: project.instrument_model,
                    visual_qc_status_label: sample.visual_qc_status_label,
                    filter_first_image: sample.filter_first_image ?? null,
                    filter_last_image: sample.filter_last_image ?? null,
                    instrument_settings_depth_offset_m: project.override_depth_offset ?? sample.instrument_settings_depth_offset_m ?? null,
                    instrument_settings_image_volume_l: sample.instrument_settings_image_volume_l ?? null,
                    is_depth_profile: sample.sample_type_label === "Depth",
                    descent_filter_enabled: project.enable_descent_filter,
                    records,
                }));
            } catch (error) {
                await this.taskRepository.logMessage(task.task_log_file_path,
                    `Descent filter: cannot compute image filtering for sample '${sample.sample_name}' (${(error as Error).message}) — the filter_* columns stay empty for it`);
            }
        }
        return by_sample_id;
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
}
