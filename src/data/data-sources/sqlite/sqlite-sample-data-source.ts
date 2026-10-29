import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
//SampleRequestModel, SampleUpdateModel, SampleResponseModel 
import { EcoTaxaImportStatusModel, EcoTaxaImportStatusRequestModel, EcoTaxaSampleSummary, MinimalSampleRequestModel, PrivateSampleUpdateModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleTypeModel, SampleTypeRequestModel, SampleUpdateModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel, } from "../../../domain/entities/sample";
import { SampleDataSource } from "../../interfaces/data-sources/sample-data-source";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
import { EcoTaxaImportedSample, ExploreSampleQuery, ExploreSampleRow, StoredEcoTaxaStats } from "../../../domain/entities/explore";
import { ProjectStatsSampleRow } from "../../../domain/entities/project-stats";
import { sqlIdentifier } from "./sql-identifier"
//import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// Shared row → PublicSampleModel mapper. Used by getOne() and getAll().
// Expects the JOINs to alias `user u_qc ...` and `user u_ctd ...` so QC validator and
// CTD importator columns don't collide.
function mapRowToPublicSample(row: any): PublicSampleModel {
    const qc_first = row.qc_first_name;
    const qc_last = row.qc_last_name;
    const qc_email = row.qc_email;
    const ctd_first = row.ctd_first_name;
    const ctd_last = row.ctd_last_name;
    const ctd_email = row.ctd_email;
    const ctd_importator_name = (ctd_first || ctd_last) ? `${ctd_first ?? ""} ${ctd_last ?? ""}`.trim() : null;

    return {
        sample_id: row.sample_id,
        sample_name: row.sample_name,
        comment: row.comment,
        instrument_serial_number: row.instrument_serial_number,
        max_pressure: row.max_pressure,
        min_pressure: row.min_pressure ?? null,
        station_id: row.station_id,
        sampling_utc_date_time: row.sampling_utc_date_time,
        latitude: row.latitude,
        longitude: row.longitude,
        wind_direction: row.wind_direction,
        wind_speed: row.wind_speed,
        sea_state: row.sea_state,
        nebulousness: row.nebulousness,
        bottom_depth: row.bottom_depth,
        instrument_operator_email: row.instrument_operator_email,
        filename: row.filename,
        sample_creation_utc_date_time: row.sample_creation_utc_date_time,
        filter_first_image: row.filter_first_image,
        filter_last_image: row.filter_last_image,
        instrument_settings_acq_gain: row.instrument_settings_acq_gain,
        instrument_settings_acq_description: row.instrument_settings_acq_description,
        instrument_settings_acq_task_type: row.instrument_settings_acq_task_type,
        instrument_settings_acq_choice: row.instrument_settings_acq_choice,
        instrument_settings_acq_disk_type: row.instrument_settings_acq_disk_type,
        instrument_settings_acq_vignette_roi_enlargement_ratio: row.instrument_settings_acq_vignette_roi_enlargement_ratio,
        instrument_settings_acq_x_size: row.instrument_settings_acq_x_size,
        instrument_settings_acq_y_size: row.instrument_settings_acq_y_size,
        instrument_settings_acq_erase_border: row.instrument_settings_acq_erase_border,
        instrument_settings_acq_threshold: row.instrument_settings_acq_threshold,
        instrument_settings_acq_pressure_gain: row.instrument_settings_acq_pressure_gain ?? undefined,
        instrument_settings_process_gamma: row.instrument_settings_process_gamma,
        instrument_settings_process_vignette_resize_factor: row.instrument_settings_process_vignette_resize_factor ?? undefined,
        instrument_settings_images_post_process: row.instrument_settings_images_post_process,
        instrument_settings_aa: row.instrument_settings_aa,
        instrument_settings_exp: row.instrument_settings_exp,
        instrument_settings_image_volume_l: row.instrument_settings_image_volume_l,
        instrument_settings_pixel_size_mm: row.instrument_settings_pixel_size_mm,
        instrument_settings_depth_offset_m: row.instrument_settings_depth_offset_m,
        instrument_settings_particule_minimum_area_pixels: row.instrument_settings_particule_minimum_area_pixels,
        instrument_settings_vignette_minimum_area_pixels: row.instrument_settings_vignette_minimum_area_pixels,
        instrument_settings_acq_shutter_speed: row.instrument_settings_acq_shutter_speed,
        instrument_settings_acq_exposure: row.instrument_settings_acq_exposure,
        instrument_settings_integration_time: row.instrument_settings_integration_time ?? undefined,
        visual_qc_validator_user_id: row.visual_qc_validator_user_id,
        visual_qc_validator_user: `${qc_first ?? ""} ${qc_last ?? ""} (${qc_email ?? ""})`.trim(),
        visual_qc_validator_email: qc_email ?? null,
        visual_qc_status_id: row.visual_qc_status_id,
        visual_qc_status_label: row.visual_qc_status_label,
        visual_qc_comment: row.visual_qc_comment ?? null,
        visual_qc_validation_utc_date_time: row.visual_qc_validation_utc_date_time ?? null,
        sample_type_id: row.sample_type_id,
        sample_type_label: row.sample_type_label,
        project_id: row.project_id,
        ecotaxa_sample_imported: !!row.ecotaxa_sample_imported,
        ecotaxa_sample_import_utc_date_time: row.ecotaxa_sample_import_utc_date_time,
        ecotaxa_sample_id: row.ecotaxa_sample_id,
        ecotaxa_sample_tsv_file_name: row.ecotaxa_sample_tsv_file_name,
        ecotaxa_sample_local_folder_tsv_path: row.ecotaxa_sample_local_folder_tsv_path,
        ecotaxa_sample_nb_images: row.ecotaxa_sample_nb_images,
        ecotaxa_import_status_id: row.ecotaxa_import_status_id,
        ecotaxa_import_status_label: row.ecotaxa_import_status_label,
        ecotaxa_sample_task_id: row.ecotaxa_sample_task_id,
        ctd_imported: !!row.ctd_imported,
        ctd_station_id: row.ctd_station_id ?? null,
        ctd_file_extension: row.ctd_file_extension ?? null,
        ctd_import_utc_date_time: row.ctd_import_utc_date_time ?? null,
        ctd_original_file_name: row.ctd_original_file_name ?? null,
        ctd_imported_file_name: row.ctd_imported_file_name ?? null,
        ctd_importator_user_id: row.ctd_importator_user_id ?? null,
        ctd_latitude: row.ctd_latitude ?? null,
        ctd_longitude: row.ctd_longitude ?? null,
        ctd_import_task_id: row.ctd_import_task_id ?? null,
        ctd_description: row.ctd_description ?? null,
        use_ctd_coordinates: !!row.use_ctd_coordinates,
        ctd_importator_name,
        ctd_importator_email: ctd_email ?? null,
        nb_vignettes: row.nb_vignettes ?? 0,
        nb_black: row.nb_black ?? 0,
        nb_particles: row.nb_particles ?? null,
        particle_min_area_px: row.particle_min_area_px ?? null,
        particle_max_area_px: row.particle_max_area_px ?? null,
        nb_particles_descent_filter: row.nb_particles_descent_filter ?? null,
        particle_min_area_px_descent_filter: row.particle_min_area_px_descent_filter ?? null,
        particle_max_area_px_descent_filter: row.particle_max_area_px_descent_filter ?? null,
    };
}

function mapRowToExploreSample(row: any): ExploreSampleRow {
    return {
        sample_id: row.sample_id,
        sample_name: row.sample_name,
        project_id: row.project_id,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        sampling_utc_date_time: row.sampling_utc_date_time,
        max_pressure: row.max_pressure ?? null,
        min_pressure: row.min_pressure ?? null,
        sample_type_label: row.sample_type_label,
        visual_qc_status_label: row.visual_qc_status_label,
        ctd_imported: !!row.ctd_imported,
        ctd_file_extension: row.ctd_file_extension ?? null,
        ecotaxa_sample_imported: !!row.ecotaxa_sample_imported,
        ecotaxa_sample_id: row.ecotaxa_sample_id ?? null,
        nb_vignettes: row.nb_vignettes ?? 0,
        nb_particles: row.nb_particles ?? null,
        particle_min_area_px: row.particle_min_area_px ?? null,
        particle_max_area_px: row.particle_max_area_px ?? null,
        filter_first_image: row.filter_first_image ?? null,
        filter_last_image: row.filter_last_image ?? null,
        instrument_settings_depth_offset_m: row.instrument_settings_depth_offset_m ?? null,
        instrument_settings_image_volume_l: row.instrument_settings_image_volume_l,
        instrument_settings_aa: row.instrument_settings_aa,
        instrument_settings_exp: row.instrument_settings_exp,
        instrument_settings_particule_minimum_area_pixels: row.instrument_settings_particule_minimum_area_pixels ?? null,
    };
}

function mapRowToProjectStatsSample(row: any): ProjectStatsSampleRow {
    return {
        ...mapRowToExploreSample(row),
        station_id: row.station_id ?? "",
        sample_latitude: row.sample_latitude ?? null,
        sample_longitude: row.sample_longitude ?? null,
        ctd_latitude: row.ctd_latitude ?? null,
        ctd_longitude: row.ctd_longitude ?? null,
        use_ctd_coordinates: !!row.use_ctd_coordinates,
        sample_creation_utc_date_time: row.sample_creation_utc_date_time ?? null,
        instrument_serial_number: row.instrument_serial_number ?? "",
        instrument_settings_pixel_size_mm: row.instrument_settings_pixel_size_mm ?? null,
        instrument_settings_acq_gain: row.instrument_settings_acq_gain ?? null,
        instrument_settings_acq_threshold: row.instrument_settings_acq_threshold ?? null,
        instrument_settings_acq_exposure: row.instrument_settings_acq_exposure ?? null,
    };
}

// The sample's reference position: the CTD one when chosen and present, the particle file's otherwise.
const EXPLORE_LATITUDE = "CASE WHEN sample.use_ctd_coordinates = 1 AND sample.ctd_latitude IS NOT NULL AND sample.ctd_longitude IS NOT NULL THEN sample.ctd_latitude ELSE sample.latitude END";
const EXPLORE_LONGITUDE = "CASE WHEN sample.use_ctd_coordinates = 1 AND sample.ctd_latitude IS NOT NULL AND sample.ctd_longitude IS NOT NULL THEN sample.ctd_longitude ELSE sample.longitude END";
// Samples imported before the ISO conversion keep their UVP date formats, "20120520080213" (UVP5) and
// "20230406-144332-820" (UVP6): read as ISO date-times, like the ones written since.
const DIGITS = (n: number) => "[0-9]".repeat(n);
const EXPLORE_SAMPLING_TIME = `CASE
    WHEN sample.sampling_utc_date_time GLOB '${DIGITS(14)}*' THEN substr(sample.sampling_utc_date_time, 1, 4) || '-' || substr(sample.sampling_utc_date_time, 5, 2) || '-' || substr(sample.sampling_utc_date_time, 7, 2) || 'T' || substr(sample.sampling_utc_date_time, 9, 2) || ':' || substr(sample.sampling_utc_date_time, 11, 2) || ':' || substr(sample.sampling_utc_date_time, 13, 2) || 'Z'
    WHEN sample.sampling_utc_date_time GLOB '${DIGITS(8)}-${DIGITS(6)}*' THEN substr(sample.sampling_utc_date_time, 1, 4) || '-' || substr(sample.sampling_utc_date_time, 5, 2) || '-' || substr(sample.sampling_utc_date_time, 7, 2) || 'T' || substr(sample.sampling_utc_date_time, 10, 2) || ':' || substr(sample.sampling_utc_date_time, 12, 2) || ':' || substr(sample.sampling_utc_date_time, 14, 2) || 'Z'
    ELSE sample.sampling_utc_date_time END`;
// The particle statistics the project's descent filter selects (see SampleParticleStats). Expects the
// query to join `project`.
const PARTICLE_STATS_OF_PROJECT = ["nb_particles", "particle_min_area_px", "particle_max_area_px"]
    .map(column => `CASE WHEN project.enable_descent_filter = 1 THEN sample.${column}_descent_filter ELSE sample.${column} END AS ${column}`)
    .join(", ");
const EXPLORE_MINUTE_OF_DAY = `(CAST(strftime('%H', ${EXPLORE_SAMPLING_TIME}) AS INTEGER) * 60 + CAST(strftime('%M', ${EXPLORE_SAMPLING_TIME}) AS INTEGER))`;

const escapeLike = (fragment: string) => fragment.replace(/[\\%_]/g, (c) => "\\" + c);

// const DB_TABLE = "sample"
export class SQLiteSampleDataSource implements SampleDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
    }

    async createOne(sample: SampleRequestCreationModel): Promise<number> {
        const params = [
            sample.sample_name, sample.comment, sample.instrument_serial_number,
            sample.max_pressure, sample.station_id, sample.sampling_utc_date_time, sample.latitude, sample.longitude,
            sample.wind_direction, sample.wind_speed, sample.sea_state, sample.nebulousness, sample.bottom_depth,
            sample.instrument_operator_email, sample.filename, sample.filter_first_image, sample.filter_last_image,
            sample.instrument_settings_acq_gain, sample.instrument_settings_acq_description, sample.instrument_settings_acq_task_type,
            sample.instrument_settings_acq_choice, sample.instrument_settings_acq_disk_type,
            sample.instrument_settings_acq_vignette_roi_enlargement_ratio,
            sample.instrument_settings_acq_x_size, sample.instrument_settings_acq_y_size, sample.instrument_settings_acq_erase_border,
            sample.instrument_settings_acq_threshold, sample.instrument_settings_acq_pressure_gain,
            sample.instrument_settings_process_gamma,
            sample.instrument_settings_process_vignette_resize_factor,
            sample.instrument_settings_images_post_process, sample.instrument_settings_aa, sample.instrument_settings_exp,
            sample.instrument_settings_image_volume_l, sample.instrument_settings_pixel_size_mm, sample.instrument_settings_depth_offset_m,
            sample.instrument_settings_particule_minimum_area_pixels, sample.instrument_settings_vignette_minimum_area_pixels,
            sample.instrument_settings_acq_shutter_speed, sample.instrument_settings_acq_exposure,
            sample.instrument_settings_integration_time,
            sample.visual_qc_validator_user_id, sample.sample_type_id, sample.project_id,
            sample.nb_vignettes, sample.nb_black,
            sample.nb_particles ?? null, sample.particle_min_area_px ?? null, sample.particle_max_area_px ?? null,
            sample.nb_particles_descent_filter ?? null, sample.particle_min_area_px_descent_filter ?? null, sample.particle_max_area_px_descent_filter ?? null,
            sample.min_pressure ?? null,
            // Explicit ISO 8601 UTC timestamp for sample_creation_utc_date_time
            // (see sqlite-task-data-source about why we no longer rely on DEFAULT CURRENT_TIMESTAMP).
            new Date().toISOString(),
        ]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO sample (
            sample_name, comment, instrument_serial_number,
            max_pressure, station_id, sampling_utc_date_time, latitude, longitude,
            wind_direction, wind_speed, sea_state, nebulousness, bottom_depth,
            instrument_operator_email, filename, filter_first_image, filter_last_image,
            instrument_settings_acq_gain, instrument_settings_acq_description, instrument_settings_acq_task_type,
            instrument_settings_acq_choice, instrument_settings_acq_disk_type,
            instrument_settings_acq_vignette_roi_enlargement_ratio,
            instrument_settings_acq_x_size, instrument_settings_acq_y_size, instrument_settings_acq_erase_border,
            instrument_settings_acq_threshold, instrument_settings_acq_pressure_gain,
            instrument_settings_process_gamma,
            instrument_settings_process_vignette_resize_factor,
            instrument_settings_images_post_process, instrument_settings_aa, instrument_settings_exp,
            instrument_settings_image_volume_l, instrument_settings_pixel_size_mm, instrument_settings_depth_offset_m,
            instrument_settings_particule_minimum_area_pixels, instrument_settings_vignette_minimum_area_pixels,
            instrument_settings_acq_shutter_speed, instrument_settings_acq_exposure,
            instrument_settings_integration_time,
            visual_qc_validator_user_id, sample_type_id, project_id,
            nb_vignettes, nb_black,
            nb_particles, particle_min_area_px, particle_max_area_px,
            nb_particles_descent_filter, particle_min_area_px_descent_filter, particle_max_area_px_descent_filter,
            min_pressure,
            sample_creation_utc_date_time
        ) VALUES  (` + placeholders + `);`;

        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.log("DB error--", err)
                    reject(err);
                } else {
                    const result = this.lastID;
                    resolve(result);
                }
            });
        })
    }

    // The connection is shared by the whole app and SQLite cannot nest transactions: a second
    // createMany issuing BEGIN while one is open fails with "cannot start a transaction within a
    // transaction". Transactions are therefore chained, one at a time.
    private transaction_queue: Promise<unknown> = Promise.resolve()

    async createMany(samples: SampleRequestCreationModel[]): Promise<number[]> {
        const result = this.transaction_queue.then(() => this.createManyInTransaction(samples));
        this.transaction_queue = result.catch(() => undefined);
        return result;
    }

    private async createManyInTransaction(samples: SampleRequestCreationModel[]): Promise<number[]> {
        await this.runStatement('BEGIN TRANSACTION', "Failed to begin transaction: ");
        try {
            // Sequential inserts: no statement of the batch can still be pending when ROLLBACK runs.
            const insertedIds: number[] = [];
            for (const sample of samples) {
                insertedIds.push(await this.createOne(sample).catch((err) => { throw new Error(`Failed to insert sample ${sample.sample_name}: ${err}`) }));
            }
            await this.runStatement('COMMIT', "Failed to commit transaction: ");
            return insertedIds;
        } catch (error) {
            // A failed COMMIT leaves the transaction open too: always close it, otherwise every
            // later BEGIN fails and every later write on the connection stays uncommitted.
            await this.runStatement('ROLLBACK', "Failed to rollback transaction: ");
            throw new Error("Transaction rolled back due to error: " + error);
        }
    }

    private runStatement(sql: string, error_prefix: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, [], (err) => err ? reject(new Error(error_prefix + err)) : resolve());
        });
    }

    async getOne(sample: MinimalSampleRequestModel): Promise<PublicSampleModel | null> {
        //can be search by sample_id, by sample_name and project_id
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(sample)) {
            params.push(value)
            placeholders = placeholders + "sample." + sqlIdentifier(key) + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);

        // if no params, return null
        if (params.length == 0) {
            return null
        }

        // form final sql — two user joins (qc validator + ctd importator), aliased so the row mapper can read both
        const sql = `SELECT sample.*,
                u_qc.first_name AS qc_first_name, u_qc.last_name AS qc_last_name, u_qc.email AS qc_email,
                u_ctd.first_name AS ctd_first_name, u_ctd.last_name AS ctd_last_name, u_ctd.email AS ctd_email,
                sample_type.sample_type_label,
                ecotaxa_import_status.ecotaxa_import_status_label,
                visual_quality_check_status.visual_qc_status_label
            FROM sample
            LEFT JOIN sample_type ON sample.sample_type_id = sample_type.sample_type_id
            LEFT JOIN visual_quality_check_status ON sample.visual_qc_status_id = visual_quality_check_status.visual_qc_status_id
            LEFT JOIN user u_qc ON sample.visual_qc_validator_user_id = u_qc.user_id
            LEFT JOIN user u_ctd ON sample.ctd_importator_user_id = u_ctd.user_id
            LEFT JOIN ecotaxa_import_status ON sample.ecotaxa_import_status_id = ecotaxa_import_status.ecotaxa_import_status_id
            WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) {
                        resolve(null);
                        return;
                    }
                    else {
                        const result = mapRowToPublicSample(row);
                        resolve(result);
                    }
                }
            });
        })
    }

    async deleteOne(sample: SampleIdModel): Promise<number> {
        // delete sample based on sample_id
        const sql = `DELETE FROM sample WHERE sample_id = (?)`;
        return await new Promise((resolve, reject) => {
            this.db.run(sql, [sample.sample_id], function (err) {
                if (err) {
                    console.log("DB error--", err)
                    reject(err);
                } else {
                    const result = this.changes; //RETURN NB OF CHANGES
                    resolve(result);
                }
            });
        })
    }

    async deleteOneEcoTaxaSample(sample: SampleIdModel): Promise<number> {
        // reset to null and 0 ecotaxa fields based on sample_id
        const sql = `UPDATE sample SET ecotaxa_sample_imported = 0, ecotaxa_sample_import_utc_date_time = NULL, ecotaxa_sample_id = NULL, ecotaxa_sample_tsv_file_name = NULL, ecotaxa_sample_local_folder_tsv_path = NULL, ecotaxa_sample_nb_images = NULL, ecotaxa_import_status_id = NULL, ecotaxa_sample_task_id = NULL WHERE sample_id = (?)`;
        return await new Promise((resolve, reject) => {
            this.db.run(sql, [sample.sample_id], function (err) {
                if (err) {
                    console.log("DB error--", err)
                    reject(err);
                } else {
                    const result = this.changes; //RETURN NB OF CHANGES
                    resolve(result);
                }
            });
        })
    }

    async getAll(options: PreparedSearchOptions): Promise<SearchResult<PublicSampleModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT sample.*,
                u_qc.first_name AS qc_first_name, u_qc.last_name AS qc_last_name, u_qc.email AS qc_email,
                u_ctd.first_name AS ctd_first_name, u_ctd.last_name AS ctd_last_name, u_ctd.email AS ctd_email,
                sample_type.sample_type_label,
                visual_quality_check_status.visual_qc_status_label,
                ecotaxa_import_status.ecotaxa_import_status_label,
                (SELECT COUNT(*) FROM sample`
        const params: any[] = []
        let filtering_sql = ""
        const params_filtering: any[] = []
        // Add filtering
        if (options.filter.length > 0) {
            filtering_sql += ` WHERE `;
            // For each filter, add to filtering_sql and params_filtering
            for (const filter of options.filter) {
                if (filter.operator == "IN" && Array.isArray(filter.value) && filter.value.length > 0) {
                    // if array do not contains null or undefined
                    if (!filter.value.includes(null) && !filter.value.includes(undefined) && filter.value.length > 0) {
                        // for eatch value in filter.value, add to filtering_sql and params_filtering
                        filtering_sql += `sample.` + filter.field + ` IN (` + filter.value.map(() => '(?)').join(',') + `) `
                        params_filtering.push(...filter.value)
                    }
                }
                // If value is a boolean (or its string form), bind as 1/0 — preserves operator
                else if (typeof filter.value === "boolean" || filter.value === "true" || filter.value === "false") {
                    const bool_val = (filter.value === true || filter.value === "true") ? 1 : 0;
                    filtering_sql += `sample.` + filter.field + ` ` + filter.operator + ` (?)`;
                    params_filtering.push(bool_val);
                }
                // If value is undefined, null or empty, and operator =, set to is null
                else if (filter.value === null || filter.value === undefined || filter.value == "null") {
                    if (filter.operator == "=") {
                        filtering_sql += `sample.` + filter.field + ` IS NULL`;
                    } else if (filter.operator == "<>") {
                        filtering_sql += `sample.` + filter.field + ` IS NOT NULL`;
                    }
                }

                else {
                    filtering_sql += `sample.` + filter.field + ` ` + filter.operator + ` (?)`
                    params_filtering.push(filter.value)
                }
                filtering_sql += ` AND `;
            }
            // remove last AND
            filtering_sql = filtering_sql.slice(0, -4);
        }
        // Add filtering_sql to sql
        sql += filtering_sql
        // Add params_filtering to params
        params.push(...params_filtering)

        sql += `
        ) AS total_count
        FROM sample
        LEFT JOIN sample_type
            ON sample.sample_type_id = sample_type.sample_type_id
        LEFT JOIN visual_quality_check_status
            ON sample.visual_qc_status_id = visual_quality_check_status.visual_qc_status_id
        LEFT JOIN user u_qc
            ON sample.visual_qc_validator_user_id = u_qc.user_id
        LEFT JOIN user u_ctd
            ON sample.ctd_importator_user_id = u_ctd.user_id
        LEFT JOIN ecotaxa_import_status
            ON sample.ecotaxa_import_status_id = ecotaxa_import_status.ecotaxa_import_status_id
        `;

        // Add filtering_sql to sql
        sql += filtering_sql
        // Add params_filtering to params
        params.push(...params_filtering)

        // Add sorting
        if (options.sort_by.length > 0) {
            sql += ` ORDER BY`;
            for (const sort of options.sort_by) {
                sql += ` ` + sort.sort_by + ` ` + sort.order_by + `,`;
            }
            // remove last ,
            sql = sql.slice(0, -1);
        }

        // Add pagination
        const page = options.page;
        const limit = options.limit;
        const offset = (page - 1) * limit;
        sql += ` LIMIT (?) OFFSET (?)`;
        params.push(limit, offset);

        // Add final ;
        sql += `;`

        return await new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    if (rows === undefined) resolve({ items: [], total: 0 });
                    const result: SearchResult<PublicSampleModel> = {
                        items: rows.map(row => mapRowToPublicSample(row)),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }

    // One query for the Explore selection: fixed, parameterised clauses, no column name from the caller.
    async getExploreSamples(query: ExploreSampleQuery): Promise<ExploreSampleRow[]> {
        const clauses: string[] = [];
        const params: any[] = [];
        if (query.sample_type_label !== null) {
            clauses.push("sample_type.sample_type_label = (?)");
            params.push(query.sample_type_label);
        }
        if (query.project_ids !== null) {
            if (query.project_ids.length === 0) return [];
            clauses.push(`sample.project_id IN (${query.project_ids.map(() => "(?)").join(",")})`);
            params.push(...query.project_ids);
        }
        if (query.bounds) {
            const { north, south, east, west } = query.bounds;
            clauses.push(`${EXPLORE_LATITUDE} BETWEEN (?) AND (?)`);
            params.push(south, north);
            if (west <= east) {
                clauses.push(`${EXPLORE_LONGITUDE} BETWEEN (?) AND (?)`);
                params.push(west, east);
            } else {
                // The box crosses the antimeridian.
                clauses.push(`(${EXPLORE_LONGITUDE} >= (?) OR ${EXPLORE_LONGITUDE} <= (?))`);
                params.push(west, east);
            }
        }
        if (query.date_from) { clauses.push(`date(${EXPLORE_SAMPLING_TIME}) >= date(?)`); params.push(query.date_from); }
        if (query.date_to) { clauses.push(`date(${EXPLORE_SAMPLING_TIME}) <= date(?)`); params.push(query.date_to); }
        if (query.months.length > 0) {
            clauses.push(`CAST(strftime('%m', ${EXPLORE_SAMPLING_TIME}) AS INTEGER) IN (${query.months.map(() => "(?)").join(",")})`);
            params.push(...query.months);
        }
        if (query.sample_names.length > 0) {
            clauses.push(`(${query.sample_names.map(() => "sample.sample_name LIKE (?) ESCAPE '\\'").join(" OR ")})`);
            params.push(...query.sample_names.map(fragment => `%${escapeLike(fragment)}%`));
        }
        if (query.hour_range) {
            const [from, to] = query.hour_range.map(hour => Math.round(hour * 60));
            if (from <= to) {
                clauses.push(`${EXPLORE_MINUTE_OF_DAY} BETWEEN (?) AND (?)`);
            } else {
                // The range crosses midnight.
                clauses.push(`(${EXPLORE_MINUTE_OF_DAY} >= (?) OR ${EXPLORE_MINUTE_OF_DAY} <= (?))`);
            }
            params.push(from, to);
        }
        if (query.pressure_range) {
            // A sample covers [0, max_pressure]: it is kept when that overlaps the range.
            clauses.push("sample.max_pressure IS NOT NULL AND sample.max_pressure >= (?)");
            params.push(query.pressure_range[0]);
        }
        if (query.ctd_only) clauses.push("sample.ctd_imported = 1");
        if (query.ecotaxa_imported_only) clauses.push("sample.ecotaxa_sample_imported = 1");

        const sql = `SELECT sample.sample_id, sample.sample_name, sample.project_id,
                ${EXPLORE_LATITUDE} AS latitude, ${EXPLORE_LONGITUDE} AS longitude,
                ${EXPLORE_SAMPLING_TIME} AS sampling_utc_date_time, sample.max_pressure, sample.min_pressure,
                sample_type.sample_type_label, visual_quality_check_status.visual_qc_status_label,
                sample.ctd_imported, sample.ctd_file_extension, sample.ecotaxa_sample_imported, sample.ecotaxa_sample_id,
                sample.nb_vignettes, ${PARTICLE_STATS_OF_PROJECT},
                sample.filter_first_image, sample.filter_last_image, sample.instrument_settings_depth_offset_m,
                sample.instrument_settings_image_volume_l, sample.instrument_settings_aa, sample.instrument_settings_exp,
                sample.instrument_settings_particule_minimum_area_pixels
            FROM sample
            LEFT JOIN project ON project.project_id = sample.project_id
            JOIN sample_type ON sample.sample_type_id = sample_type.sample_type_id
            JOIN visual_quality_check_status ON sample.visual_qc_status_id = visual_quality_check_status.visual_qc_status_id
            ${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
            ORDER BY sample.sample_id;`;
        return await new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve((rows ?? []).map(row => mapRowToExploreSample(row)));
            });
        });
    }

    // Samples per project in one query; null: every project.
    async getProjectStatsSamples(project_id: number): Promise<ProjectStatsSampleRow[]> {
        const sql = `SELECT sample.sample_id, sample.sample_name, sample.project_id,
                ${EXPLORE_LATITUDE} AS latitude, ${EXPLORE_LONGITUDE} AS longitude,
                ${EXPLORE_SAMPLING_TIME} AS sampling_utc_date_time, sample.max_pressure, sample.min_pressure,
                sample_type.sample_type_label, visual_quality_check_status.visual_qc_status_label,
                sample.ctd_imported, sample.ctd_file_extension, sample.ecotaxa_sample_imported, sample.ecotaxa_sample_id,
                sample.nb_vignettes, ${PARTICLE_STATS_OF_PROJECT},
                sample.filter_first_image, sample.filter_last_image, sample.instrument_settings_depth_offset_m,
                sample.instrument_settings_image_volume_l, sample.instrument_settings_aa, sample.instrument_settings_exp,
                sample.instrument_settings_particule_minimum_area_pixels,
                sample.station_id, sample.latitude AS sample_latitude, sample.longitude AS sample_longitude,
                sample.ctd_latitude, sample.ctd_longitude, sample.use_ctd_coordinates, sample.sample_creation_utc_date_time,
                sample.instrument_serial_number, sample.instrument_settings_pixel_size_mm, sample.instrument_settings_acq_gain,
                sample.instrument_settings_acq_threshold, sample.instrument_settings_acq_exposure
            FROM sample
            LEFT JOIN project ON project.project_id = sample.project_id
            JOIN sample_type ON sample.sample_type_id = sample_type.sample_type_id
            JOIN visual_quality_check_status ON sample.visual_qc_status_id = visual_quality_check_status.visual_qc_status_id
            WHERE sample.project_id = (?)
            ORDER BY sample.sample_id;`;
        const rows = await new Promise<any[]>((resolve, reject) => this.db.all(sql, [project_id], (err, rows) => err ? reject(err) : resolve(rows ?? [])));
        return rows.map(row => mapRowToProjectStatsSample(row));
    }

    async countSamplesPerProject(project_ids: number[] | null): Promise<Map<number, number>> {
        const counts = new Map<number, number>();
        let sql = "SELECT project_id, COUNT(*) AS nb FROM sample";
        const params: any[] = [];
        if (project_ids !== null) {
            if (project_ids.length === 0) return counts;
            sql += ` WHERE project_id IN (${project_ids.map(() => "(?)").join(",")})`;
            params.push(...project_ids);
        }
        sql += " GROUP BY project_id;";
        const rows = await new Promise<any[]>((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows ?? []));
        });
        for (const row of rows) counts.set(row.project_id, row.nb);
        return counts;
    }

    async getEcoTaxaStats(sample_ids: number[]): Promise<StoredEcoTaxaStats[]> {
        if (sample_ids.length === 0) return [];
        const sql = `SELECT * FROM sample_ecotaxa_stats WHERE sample_id IN (${sample_ids.map(() => "(?)").join(",")});`;
        const rows = await new Promise<any[]>((resolve, reject) => this.db.all(sql, sample_ids, (err, rows) => err ? reject(err) : resolve(rows ?? [])));
        return rows.map(row => ({
            sample_id: row.sample_id,
            ecotaxa_sample_id: row.ecotaxa_sample_id,
            nb_unclassified: row.nb_unclassified,
            nb_validated: row.nb_validated,
            nb_dubious: row.nb_dubious,
            nb_predicted: row.nb_predicted,
            used_taxa: String(row.used_taxa ?? "").split(",").filter(id => id !== "").map(Number),
            fetched_utc_date_time: row.fetched_utc_date_time,
        }));
    }

    async upsertEcoTaxaStats(stats: StoredEcoTaxaStats[]): Promise<void> {
        const sql = `INSERT OR REPLACE INTO sample_ecotaxa_stats
            (sample_id, ecotaxa_sample_id, nb_unclassified, nb_validated, nb_dubious, nb_predicted, used_taxa, fetched_utc_date_time)
            VALUES ((?), (?), (?), (?), (?), (?), (?), (?));`;
        for (const stat of stats) {
            await new Promise<void>((resolve, reject) => this.db.run(sql, [
                stat.sample_id, stat.ecotaxa_sample_id, stat.nb_unclassified, stat.nb_validated, stat.nb_dubious, stat.nb_predicted,
                stat.used_taxa.join(","), stat.fetched_utc_date_time,
            ], (err) => err ? reject(err) : resolve()));
        }
    }

    async listEcoTaxaImportedSamples(): Promise<(EcoTaxaImportedSample & { fetched_utc_date_time: string | null })[]> {
        const sql = `SELECT sample.sample_id, sample.sample_name, sample.project_id, sample.ecotaxa_sample_id, stats.fetched_utc_date_time
            FROM sample LEFT JOIN sample_ecotaxa_stats stats ON stats.sample_id = sample.sample_id
            WHERE sample.ecotaxa_sample_imported = 1 ORDER BY sample.sample_id;`;
        const rows = await new Promise<any[]>((resolve, reject) => this.db.all(sql, [], (err, rows) => err ? reject(err) : resolve(rows ?? [])));
        return rows.map(row => ({ sample_id: row.sample_id, sample_name: row.sample_name, project_id: row.project_id, ecotaxa_sample_id: row.ecotaxa_sample_id ?? null, fetched_utc_date_time: row.fetched_utc_date_time ?? null }));
    }

    async getEcoTaxaSampleSummaries(options: PreparedSearchOptions): Promise<SearchResult<EcoTaxaSampleSummary>> {
        // Focused query: only the three columns the EcoTaxa listing endpoint needs.
        // Builds the same WHERE / ORDER BY / LIMIT-OFFSET as getAll but without joins.
        let sql = `SELECT sample.sample_id, sample.sample_name, sample.ecotaxa_sample_id, (SELECT COUNT(*) FROM sample`;
        const params: any[] = [];
        let filtering_sql = "";
        const params_filtering: any[] = [];

        if (options.filter.length > 0) {
            filtering_sql += ` WHERE `;
            for (const filter of options.filter) {
                if (filter.operator == "IN" && Array.isArray(filter.value) && filter.value.length > 0) {
                    if (!filter.value.includes(null) && !filter.value.includes(undefined) && filter.value.length > 0) {
                        filtering_sql += `sample.` + filter.field + ` IN (` + filter.value.map(() => '(?)').join(',') + `) `;
                        params_filtering.push(...filter.value);
                    }
                } else if (typeof filter.value === "boolean" || filter.value === "true" || filter.value === "false") {
                    const bool_val = (filter.value === true || filter.value === "true") ? 1 : 0;
                    filtering_sql += `sample.` + filter.field + ` ` + filter.operator + ` (?)`;
                    params_filtering.push(bool_val);
                } else if (filter.value === null || filter.value === undefined || filter.value == "null") {
                    if (filter.operator == "=") {
                        filtering_sql += `sample.` + filter.field + ` IS NULL`;
                    } else if (filter.operator == "<>") {
                        filtering_sql += `sample.` + filter.field + ` IS NOT NULL`;
                    }
                } else {
                    filtering_sql += `sample.` + filter.field + ` ` + filter.operator + ` (?)`;
                    params_filtering.push(filter.value);
                }
                filtering_sql += ` AND `;
            }
            filtering_sql = filtering_sql.slice(0, -4);
        }

        sql += filtering_sql;
        params.push(...params_filtering);

        sql += `) AS total_count FROM sample`;

        sql += filtering_sql;
        params.push(...params_filtering);

        if (options.sort_by.length > 0) {
            sql += ` ORDER BY`;
            for (const sort of options.sort_by) {
                sql += ` ` + sort.sort_by + ` ` + sort.order_by + `,`;
            }
            sql = sql.slice(0, -1);
        }

        const page = options.page;
        const limit = options.limit;
        const offset = (page - 1) * limit;
        sql += ` LIMIT (?) OFFSET (?);`;
        params.push(limit, offset);

        return await new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    if (rows === undefined) return resolve({ items: [], total: 0 });
                    const result: SearchResult<EcoTaxaSampleSummary> = {
                        items: rows.map(row => ({
                            sample_id: row.sample_id,
                            sample_name: row.sample_name,
                            ecotaxa_sample_id: row.ecotaxa_sample_id,
                        })),
                        total: rows[0]?.total_count || 0,
                    };
                    resolve(result);
                }
            });
        });
    }

    // Update One Sample
    // Returns the number of lines updates
    async updateOne(sample: PrivateSampleUpdateModel): Promise<number> {
        const { sample_id, ...sampleData } = sample; // Destructure the sample object
        const params: any[] = []
        let placeholders: string = ""
        // Generate sql and params
        for (const [key, value] of Object.entries(sampleData)) {
            // if value is boolean, convert to integer 1 or 0
            if (typeof value === "boolean") {
                params.push(value ? 1 : 0)
            } else {
                params.push(value)
            }
            placeholders = placeholders + sqlIdentifier(key) + "=(?),"
        }
        // Remove last ,
        placeholders = placeholders.slice(0, -1);
        // add sample_id to params
        params.push(sample_id)

        // Form final sql
        const sql = `UPDATE sample SET ` + placeholders + ` WHERE sample_id=(?);`;
        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    const result = this.changes;
                    resolve(result);
                }
            });
        })
    }

    async updateMany(sampleData: Partial<SampleUpdateModel>, filter: MinimalSampleRequestModel): Promise<number> {
        const { sample_id: _ignored, ...data } = sampleData as Record<string, unknown>;
        const setParams: unknown[] = [];
        let setPlaceholders = "";
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            setParams.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
            setPlaceholders += `${sqlIdentifier(key)} = (?),`;
        }
        setPlaceholders = setPlaceholders.slice(0, -1);

        const whereParams: unknown[] = [];
        let wherePlaceholders = "";
        for (const [key, value] of Object.entries(filter)) {
            if (value === undefined) continue;
            whereParams.push(value);
            wherePlaceholders += `${sqlIdentifier(key)} = (?) AND `;
        }
        wherePlaceholders = wherePlaceholders.slice(0, -5);

        if (!setPlaceholders) throw new Error("Please provide at least one field to update");
        if (!wherePlaceholders) throw new Error("Please provide at least one filter");

        const sql = `UPDATE sample SET ${setPlaceholders} WHERE ${wherePlaceholders};`;

        return await new Promise((resolve, reject) => {
            this.db.run(sql, [...setParams, ...whereParams], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }

    async getSampleType(sampleType: SampleTypeRequestModel): Promise<SampleTypeModel | null> {
        //can be search by sample_type_id, sample_type_label, sample_type_description
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(sampleType)) {
            params.push(value)
            placeholders = placeholders + sqlIdentifier(key) + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);

        // if no params, return null
        if (params.length == 0) {
            return null
        }

        const sql = `SELECT * FROM sample_type WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) {
                        resolve(null);
                        return;
                    }
                    else {
                        const result = {
                            sample_type_id: row.sample_type_id,
                            sample_type_label: row.sample_type_label,
                            sample_type_description: row.sample_type_description
                        };
                        resolve(result);
                    }
                }
            });
        })
    }
    async getEcoTaxaImportStatus(ecotaxaImportStatus: EcoTaxaImportStatusRequestModel): Promise<EcoTaxaImportStatusModel | null> {
        //can be search by ecotaxa_import_status_id, ecotaxa_import_status_label
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(ecotaxaImportStatus)) {
            params.push(value)
            placeholders = placeholders + sqlIdentifier(key) + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);

        // if no params, return null
        if (params.length == 0) {
            return null
        }
        const sql = `SELECT * FROM ecotaxa_import_status WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) {
                        resolve(null);
                        return;
                    }
                    else {
                        const result = {
                            ecotaxa_import_status_id: row.ecotaxa_import_status_id,
                            ecotaxa_import_status_label: row.ecotaxa_import_status_label
                        };
                        resolve(result);
                    }
                }
            });
        })
    }

    async getVisualQCStatus(visualQCStatus: VisualQualityCheckStatusRequestModel): Promise<VisualQualityCheckStatusModel | null> {
        //can be search by visual_qc_status_id, visual_qc_status_label
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(visualQCStatus)) {
            params.push(value)
            placeholders = placeholders + sqlIdentifier(key) + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);

        // if no params, return null
        if (params.length == 0) {
            return null
        }
        const sql = `SELECT * FROM visual_quality_check_status WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) {
                        resolve(null);
                        return;
                    }
                    else {
                        const result = {
                            visual_qc_status_id: row.visual_qc_status_id,
                            visual_qc_status_label: row.visual_qc_status_label
                        };
                        resolve(result);
                    }
                }
            });
        })
    }
}

