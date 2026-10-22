import path from "path";
import * as fsPromises from "fs/promises";

import { MinimalUserModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { TaskResponseModel } from "../../entities/task";
import { ImageFilteringMetadata } from "../../entities/sample-qc-graph";
import { ExportTableFormat } from "../../entities/export";

import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { buildImageFilteringMetadata } from "../sample/qc-graphs-builder";
import { computeProjectPrivacy } from "../../utils/project-privacy";
import { dateValue, TableColumn, TableValue, writeTable } from "./table";

// `metadata/projects` and `metadata/samples`, identical in every export product: the raw export
// and the binned export both write them with this writer, as TSV or Parquet. The integer columns
// are the values EcoPart itself produces as whole numbers (identifiers, counts, statuses, delays);
// the instrument settings come from the acquisition files as parsed and stay doubles.

export const PROJECT_COLUMNS: TableColumn[] = [
    { name: "ecopart_project_id", type: "integer" },
    { name: "ecopart_project_title", type: "string" },
    { name: "project_total_samples", type: "integer" },
    { name: "project_total_samples_exported", type: "integer" },
    { name: "ecotaxa_instance_url", type: "string" },
    { name: "ecotaxa_project_id", type: "integer" },
    { name: "ecotaxa_project_title", type: "string" },
    { name: "project_total_ecotaxa_samples", type: "integer" },
    { name: "project_total_ecotaxa_samples_exported", type: "integer" },
    { name: "project_acronym", type: "string" },
    { name: "project_description", type: "string" },
    { name: "project_cruise_wmo", type: "string" },
    { name: "project_ship_floatref", type: "string" },
    { name: "project_data_owner_name", type: "string" },
    { name: "project_data_owner_email", type: "string" },
    { name: "project_operator_name", type: "string" },
    { name: "project_operator_email", type: "string" },
    { name: "project_chief_scientist_name", type: "string" },
    { name: "project_chief_scientist_email", type: "string" },
    { name: "project_instrument", type: "string" },
    { name: "project_instrument_model_name", type: "string" },
    { name: "project_instrument_serial_number", type: "string" },
    { name: "project_override_depth_offset", type: "double" },
    { name: "project_enable_descent_filter", type: "boolean" },
    { name: "project_creation_utc_date_time", type: "timestamp" },
    { name: "project_export_utc_date_time", type: "timestamp" },
    { name: "project_privacy", type: "string" },
    { name: "project_privacy_delay", type: "integer" },
    { name: "project_general_download_delay", type: "integer" },
    { name: "project_ecotaxa_classification_download_delay", type: "integer" },
    { name: "project_managers", type: "string" },
    { name: "project_members", type: "string" },
];

export const SAMPLE_COLUMNS: TableColumn[] = [
    { name: "ecopart_project_id", type: "integer" },
    { name: "ecopart_sample_id", type: "integer" },
    { name: "sample_name", type: "string" },
    { name: "sample_comment", type: "string" },
    { name: "sample_type", type: "string" },
    { name: "sampling_utc_date_time", type: "timestamp" },
    { name: "sample_import_utc_date_time", type: "timestamp" },
    { name: "sample_max_pressure", type: "double" },
    { name: "station_id", type: "string" },
    { name: "sample_latitude", type: "double" },
    { name: "sample_longitude", type: "double" },
    { name: "environment_wind_direction", type: "double" },
    { name: "environment_sea_state", type: "string" },
    { name: "environment_bottom_depth", type: "double" },
    { name: "environment_wind_speed", type: "double" },
    { name: "environment_nebulousness", type: "double" },
    { name: "instrument_operator_email", type: "string" },
    { name: "ecotaxa_sample_imported", type: "boolean" },
    { name: "ecotaxa_sample_import_utc_date_time", type: "timestamp" },
    { name: "ecotaxa_sample_id", type: "integer" },
    { name: "ecotaxa_sample_tsv_file_name", type: "string" },
    { name: "ecotaxa_sample_nb_images", type: "integer" },
    { name: "ecotaxa_import_status_id", type: "integer" },
    { name: "ecotaxa_import_status_label", type: "string" },
    { name: "ecotaxa_sample_task_id", type: "integer" },
    { name: "instrument_settings_serial_number", type: "string" },
    { name: "instrument_settings_aa", type: "double" },
    { name: "instrument_settings_exp", type: "double" },
    { name: "instrument_settings_image_volume_l", type: "double" },
    { name: "instrument_settings_pixel_size_mm", type: "double" },
    { name: "instrument_settings_depth_offset_m", type: "double" },
    { name: "instrument_settings_acq_pressure_gain", type: "double" },
    { name: "instrument_settings_particule_minimum_area_pixels", type: "double" },
    { name: "instrument_settings_vignette_minimum_area_pixels", type: "double" },
    { name: "instrument_settings_acq_shutter_speed", type: "double" },
    { name: "instrument_settings_acq_gain", type: "double" },
    { name: "instrument_settings_acq_x_size", type: "double" },
    { name: "instrument_settings_acq_y_size", type: "double" },
    { name: "instrument_settings_acq_description", type: "string" },
    { name: "instrument_settings_acq_choice", type: "double" },
    { name: "instrument_settings_acq_disk_type", type: "double" },
    { name: "instrument_settings_acq_threshold", type: "double" },
    { name: "instrument_settings_acq_exposure", type: "double" },
    { name: "instrument_settings_acq_erase_border", type: "double" },
    { name: "instrument_settings_acq_task_type", type: "double" },
    { name: "instrument_settings_acq_vignette_roi_enlargement_ratio", type: "double" },
    { name: "instrument_settings_process_gamma", type: "double" },
    { name: "instrument_settings_process_vignette_resize_factor", type: "double" },
    { name: "instrument_settings_images_post_process", type: "string" },
    { name: "sample_integration_time", type: "double" },
    { name: "filename", type: "string" },
    { name: "filter_first_image", type: "string" },
    { name: "filter_last_image", type: "string" },
    { name: "filter_last_image_used", type: "string" },
    { name: "filter_removed_images_count", type: "integer" },
    { name: "filter_removed_images_percent", type: "double" },
    { name: "ctd_original_file_name", type: "string" },
    { name: "ctd_imported_file_name", type: "string" },
    { name: "ctd_importator_name", type: "string" },
    { name: "ctd_importator_email", type: "string" },
    { name: "ctd_import_utc_date_time", type: "timestamp" },
    { name: "ctd_latitude", type: "double" },
    { name: "ctd_longitude", type: "double" },
    { name: "visual_qc_status", type: "string" },
    { name: "visual_qc_validator_email", type: "string" },
    { name: "number_of_black", type: "integer" },
];

function serializeUserList(users: MinimalUserModel[]): string {
    return users.map(u => `${u.user_name} <${u.email}>`).join("; ");
}

// A value as stored, an absent one as null.
function cell(value: TableValue | undefined): TableValue {
    return value ?? null;
}

export class ExportMetadataWriter {
    constructor(
        private sampleRepository: SampleRepository,
        private privilegeRepository: PrivilegeRepository,
        private taskRepository: TaskRepository,
        private ecotaxaAccountRepository: EcotaxaAccountRepository,
        private instrumentModelRepository: InstrumentModelRepository,
    ) { }

    // Writes `projects.<format>` and `samples.<format>` into `dir`. `ecotaxa_in_export` tells
    // whether the export also ships EcoTaxa data, which `project_total_ecotaxa_samples_exported` counts.
    async write(
        task: TaskResponseModel,
        dir: string,
        samples: PublicSampleModel[],
        projects_by_id: Map<number, ProjectResponseModel>,
        export_started_at: Date,
        ecotaxa_in_export: boolean,
        format: ExportTableFormat,
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

        const project_rows: Record<string, TableValue>[] = [];
        for (const project of projects_by_id.values()) {
            const ecotaxa_instance_url = await this.resolveEcotaxaInstanceUrl(project.ecotaxa_instance_id);
            const bodc = await this.resolveInstrumentBodc(project.instrument_model);
            const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: project.project_id });
            const managers = privileges?.managers ?? [];
            const members = privileges?.members ?? [];
            project_rows.push({
                ecopart_project_id: cell(project.project_id),
                ecopart_project_title: cell(project.project_title),
                ecotaxa_instance_url: cell(ecotaxa_instance_url),
                ecotaxa_project_id: cell(project.ecotaxa_project_id),
                ecotaxa_project_title: cell(project.ecotaxa_project_name),
                project_total_samples: cell(samples_per_project_total.get(project.project_id) ?? 0),
                project_total_samples_exported: cell(exported_per_project.get(project.project_id) ?? 0),
                project_total_ecotaxa_samples: cell(ecotaxa_samples_per_project_total.get(project.project_id) ?? 0),
                project_total_ecotaxa_samples_exported: cell(ecotaxa_exported_per_project.get(project.project_id) ?? 0),
                project_acronym: cell(project.project_acronym),
                project_description: cell(project.project_description),
                project_cruise_wmo: cell(project.cruise),
                project_ship_floatref: cell(project.ship),
                project_data_owner_name: cell(project.data_owner_name),
                project_data_owner_email: cell(project.data_owner_email),
                project_operator_name: cell(project.operator_name),
                project_operator_email: cell(project.operator_email),
                project_chief_scientist_name: cell(project.chief_scientist_name),
                project_chief_scientist_email: cell(project.chief_scientist_email),
                project_instrument: cell(bodc),
                project_instrument_model_name: cell(project.instrument_model),
                project_instrument_serial_number: cell(project.serial_number),
                project_override_depth_offset: cell(project.override_depth_offset),
                project_enable_descent_filter: cell(project.enable_descent_filter),
                project_creation_utc_date_time: dateValue(project.project_creation_utc_date_time),
                project_export_utc_date_time: export_started_at,
                project_privacy: computeProjectPrivacy(
                    project.project_creation_utc_date_time,
                    project.privacy_duration,
                    project.visible_duration,
                    project.public_duration,
                    export_started_at,
                ),
                project_privacy_delay: cell(project.privacy_duration),
                project_general_download_delay: cell(project.visible_duration),
                project_ecotaxa_classification_download_delay: cell(project.public_duration),
                project_managers: serializeUserList(managers),
                project_members: serializeUserList(members),
            });
        }

        await writeTable(format, path.join(dir, "projects"), PROJECT_COLUMNS, project_rows.map(row => PROJECT_COLUMNS.map(column => row[column.name] ?? null)));

        // Stable, reproducible row order: by (ecopart_project_id, ecopart_sample_id).
        const ordered_samples = [...samples].sort((a, b) =>
            a.project_id - b.project_id || a.sample_id - b.sample_id);

        const filtering_by_sample_id = await this.computeImageFiltering(task, ordered_samples, projects_by_id);

        const sample_rows: Record<string, TableValue>[] = ordered_samples.map(sample => ({
            ecopart_project_id: cell(sample.project_id),
            ecopart_sample_id: cell(sample.sample_id),
            sample_name: cell(sample.sample_name),
            sample_comment: cell(sample.comment),
            sample_type: cell(sample.sample_type_label),
            sampling_utc_date_time: dateValue(sample.sampling_utc_date_time),
            sample_import_utc_date_time: dateValue(sample.sample_creation_utc_date_time),
            sample_max_pressure: cell(sample.max_pressure),
            station_id: cell(sample.station_id),
            sample_latitude: cell(sample.latitude),
            sample_longitude: cell(sample.longitude),
            environment_wind_direction: cell(sample.wind_direction),
            environment_sea_state: cell(sample.sea_state),
            environment_bottom_depth: cell(sample.bottom_depth),
            environment_wind_speed: cell(sample.wind_speed),
            environment_nebulousness: cell(sample.nebulousness),
            instrument_operator_email: cell(sample.instrument_operator_email),
            ecotaxa_sample_imported: cell(sample.ecotaxa_sample_imported),
            ecotaxa_sample_import_utc_date_time: dateValue(sample.ecotaxa_sample_import_utc_date_time),
            ecotaxa_sample_id: cell(sample.ecotaxa_sample_id),
            ecotaxa_sample_tsv_file_name: cell(sample.ecotaxa_sample_tsv_file_name),
            ecotaxa_sample_nb_images: cell(sample.ecotaxa_sample_nb_images),
            ecotaxa_import_status_id: cell(sample.ecotaxa_import_status_id),
            ecotaxa_import_status_label: cell(sample.ecotaxa_import_status_label),
            ecotaxa_sample_task_id: cell(sample.ecotaxa_sample_task_id),
            instrument_settings_serial_number: cell(sample.instrument_serial_number),
            instrument_settings_aa: cell(sample.instrument_settings_aa),
            instrument_settings_exp: cell(sample.instrument_settings_exp),
            instrument_settings_image_volume_l: cell(sample.instrument_settings_image_volume_l),
            instrument_settings_pixel_size_mm: cell(sample.instrument_settings_pixel_size_mm),
            instrument_settings_depth_offset_m: cell(sample.instrument_settings_depth_offset_m),
            instrument_settings_acq_pressure_gain: cell(sample.instrument_settings_acq_pressure_gain),
            instrument_settings_particule_minimum_area_pixels: cell(sample.instrument_settings_particule_minimum_area_pixels),
            instrument_settings_vignette_minimum_area_pixels: cell(sample.instrument_settings_vignette_minimum_area_pixels),
            instrument_settings_acq_shutter_speed: cell(sample.instrument_settings_acq_shutter_speed),
            instrument_settings_acq_gain: cell(sample.instrument_settings_acq_gain),
            instrument_settings_acq_x_size: cell(sample.instrument_settings_acq_x_size),
            instrument_settings_acq_y_size: cell(sample.instrument_settings_acq_y_size),
            instrument_settings_acq_description: cell(sample.instrument_settings_acq_description),
            instrument_settings_acq_choice: cell(sample.instrument_settings_acq_choice),
            instrument_settings_acq_disk_type: cell(sample.instrument_settings_acq_disk_type),
            instrument_settings_acq_threshold: cell(sample.instrument_settings_acq_threshold),
            instrument_settings_acq_exposure: cell(sample.instrument_settings_acq_exposure),
            instrument_settings_acq_erase_border: cell(sample.instrument_settings_acq_erase_border),
            instrument_settings_acq_task_type: cell(sample.instrument_settings_acq_task_type),
            instrument_settings_acq_vignette_roi_enlargement_ratio: cell(sample.instrument_settings_acq_vignette_roi_enlargement_ratio),
            instrument_settings_process_gamma: cell(sample.instrument_settings_process_gamma),
            instrument_settings_process_vignette_resize_factor: cell(sample.instrument_settings_process_vignette_resize_factor),
            instrument_settings_images_post_process: cell(sample.instrument_settings_images_post_process),
            sample_integration_time: cell(sample.instrument_settings_integration_time),
            filename: cell(sample.filename),
            filter_first_image: cell(sample.filter_first_image),
            filter_last_image: cell(sample.filter_last_image),
            filter_last_image_used: cell(filtering_by_sample_id.get(sample.sample_id)?.last_image_used),
            filter_removed_images_count: cell(filtering_by_sample_id.get(sample.sample_id)?.removed_images.count),
            filter_removed_images_percent: cell(filtering_by_sample_id.get(sample.sample_id)?.removed_images.percent),
            ctd_original_file_name: cell(sample.ctd_original_file_name),
            ctd_imported_file_name: cell(sample.ctd_imported_file_name),
            ctd_importator_name: cell(sample.ctd_importator_name),
            ctd_importator_email: cell(sample.ctd_importator_email),
            ctd_import_utc_date_time: dateValue(sample.ctd_import_utc_date_time),
            ctd_latitude: cell(sample.ctd_latitude),
            ctd_longitude: cell(sample.ctd_longitude),
            visual_qc_status: cell(sample.visual_qc_status_label),
            visual_qc_validator_email: cell(sample.visual_qc_validator_email),
            number_of_black: cell(sample.nb_black),
        }));

        await writeTable(format, path.join(dir, "samples"), SAMPLE_COLUMNS, sample_rows.map(row => SAMPLE_COLUMNS.map(column => row[column.name] ?? null)));
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
