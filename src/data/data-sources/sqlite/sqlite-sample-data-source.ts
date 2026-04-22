import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
//SampleRequestModel, SampleUpdateModel, SampleResponseModel 
import { EcoTaxaImportStatusModel, EcoTaxaImportStatusRequestModel, MinimalSampleRequestModel, PrivateSampleUpdateModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleTypeModel, SampleTypeRequestModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel, } from "../../../domain/entities/sample";
import { SampleDataSource } from "../../interfaces/data-sources/sample-data-source";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
//import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// const DB_TABLE = "sample"
export class SQLiteSampleDataSource implements SampleDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
    }

    async createOne(sample: SampleRequestCreationModel): Promise<number> {
        const params = [sample.sample_name, sample.comment, sample.instrument_serial_number, sample.optional_structure_id, sample.max_pressure, sample.station_id, sample.sampling_date, sample.latitude, sample.longitude, sample.wind_direction, sample.wind_speed, sample.sea_state, sample.nebulousness, sample.bottom_depth, sample.instrument_operator_email, sample.filename, sample.filter_first_image, sample.filter_last_image, sample.instrument_settings_acq_gain, sample.instrument_settings_acq_description, sample.instrument_settings_acq_task_type, sample.instrument_settings_acq_choice, sample.instrument_settings_acq_disk_type, sample.instrument_settings_acq_appendices_ratio, sample.instrument_settings_acq_xsize, sample.instrument_settings_acq_ysize, sample.instrument_settings_acq_erase_border, sample.instrument_settings_acq_threshold, sample.instrument_settings_process_datetime, sample.instrument_settings_process_gamma, sample.instrument_settings_images_post_process, sample.instrument_settings_aa, sample.instrument_settings_exp, sample.instrument_settings_image_volume_l, sample.instrument_settings_pixel_size_mm, sample.instrument_settings_depth_offset_m, sample.instrument_settings_particle_minimum_size_pixels, sample.instrument_settings_vignettes_minimum_size_pixels, sample.instrument_settings_particle_minimum_size_esd, sample.instrument_settings_vignettes_minimum_size_esd, sample.instrument_settings_acq_shutter, sample.instrument_settings_acq_shutter_speed, sample.instrument_settings_acq_exposure, sample.visual_qc_validator_user_id, sample.sample_type_id, sample.project_id]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO sample (sample_name, comment, instrument_serial_number, optional_structure_id, max_pressure, station_id, sampling_date, latitude, longitude, wind_direction, wind_speed, sea_state, nebulousness, bottom_depth, instrument_operator_email, filename, filter_first_image, filter_last_image, instrument_settings_acq_gain, instrument_settings_acq_description, instrument_settings_acq_task_type, instrument_settings_acq_choice, instrument_settings_acq_disk_type, instrument_settings_acq_appendices_ratio, instrument_settings_acq_xsize, instrument_settings_acq_ysize, instrument_settings_acq_erase_border, instrument_settings_acq_threshold, instrument_settings_process_datetime, instrument_settings_process_gamma, instrument_settings_images_post_process, instrument_settings_aa, instrument_settings_exp, instrument_settings_image_volume_l, instrument_settings_pixel_size_mm, instrument_settings_depth_offset_m, instrument_settings_particle_minimum_size_pixels, instrument_settings_vignettes_minimum_size_pixels, instrument_settings_particle_minimum_size_esd, instrument_settings_vignettes_minimum_size_esd, instrument_settings_acq_shutter, instrument_settings_acq_shutter_speed, instrument_settings_acq_exposure, visual_qc_validator_user_id, sample_type_id, project_id
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

    async createMany(samples: SampleRequestCreationModel[]): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const insertedIds: number[] = [];
            // Begin transaction
            this.db.run('BEGIN TRANSACTION', (beginErr: Error) => {
                if (beginErr) {
                    return reject("Failed to begin transaction:" + beginErr);
                }

                const insertPromises = samples.map((sample) => {
                    return new Promise<number>((resolveInsert, rejectInsert) => {
                        const params = [
                            sample.sample_name, sample.comment, sample.instrument_serial_number,
                            sample.optional_structure_id, sample.max_pressure, sample.station_id,
                            sample.sampling_date, sample.latitude, sample.longitude, sample.wind_direction,
                            sample.wind_speed, sample.sea_state, sample.nebulousness, sample.bottom_depth,
                            sample.instrument_operator_email, sample.filename, sample.filter_first_image,
                            sample.filter_last_image,
                            sample.instrument_settings_acq_gain, sample.instrument_settings_acq_description,
                            sample.instrument_settings_acq_task_type, sample.instrument_settings_acq_choice,
                            sample.instrument_settings_acq_disk_type, sample.instrument_settings_acq_appendices_ratio,
                            sample.instrument_settings_acq_xsize, sample.instrument_settings_acq_ysize,
                            sample.instrument_settings_acq_erase_border, sample.instrument_settings_acq_threshold,
                            sample.instrument_settings_process_datetime,
                            sample.instrument_settings_process_gamma, sample.instrument_settings_images_post_process,
                            sample.instrument_settings_aa, sample.instrument_settings_exp,
                            sample.instrument_settings_image_volume_l, sample.instrument_settings_pixel_size_mm,
                            sample.instrument_settings_depth_offset_m, sample.instrument_settings_particle_minimum_size_pixels,
                            sample.instrument_settings_vignettes_minimum_size_pixels,
                            sample.instrument_settings_particle_minimum_size_esd,
                            sample.instrument_settings_vignettes_minimum_size_esd,
                            sample.instrument_settings_acq_shutter,
                            sample.instrument_settings_acq_shutter_speed, sample.instrument_settings_acq_exposure,
                            sample.visual_qc_validator_user_id, sample.sample_type_id, sample.project_id
                        ];

                        const placeholders = params.map(() => '?').join(', ');
                        const sql = `INSERT INTO sample (
                            sample_name, comment, instrument_serial_number, optional_structure_id, max_pressure, 
                            station_id, sampling_date, latitude, longitude, wind_direction, wind_speed, sea_state, 
                            nebulousness, bottom_depth, instrument_operator_email, filename, filter_first_image, filter_last_image, 
                            instrument_settings_acq_gain, instrument_settings_acq_description, instrument_settings_acq_task_type, 
                            instrument_settings_acq_choice, instrument_settings_acq_disk_type, instrument_settings_acq_appendices_ratio, 
                            instrument_settings_acq_xsize, instrument_settings_acq_ysize, instrument_settings_acq_erase_border, 
                            instrument_settings_acq_threshold, instrument_settings_process_datetime, 
                            instrument_settings_process_gamma, instrument_settings_images_post_process, 
                            instrument_settings_aa, instrument_settings_exp, instrument_settings_image_volume_l, 
                            instrument_settings_pixel_size_mm, instrument_settings_depth_offset_m, instrument_settings_particle_minimum_size_pixels, 
                            instrument_settings_vignettes_minimum_size_pixels, instrument_settings_acq_shutter_speed, 
                            instrument_settings_particle_minimum_size_esd, instrument_settings_vignettes_minimum_size_esd,
                            instrument_settings_acq_shutter, instrument_settings_acq_exposure, visual_qc_validator_user_id, sample_type_id, project_id
                        ) VALUES (${placeholders})`;

                        this.db.run(sql, params, function (err) {
                            if (err) {
                                rejectInsert("Failed to insert sample:" + err);
                            } else {
                                insertedIds.push(this.lastID);
                                resolveInsert(this.lastID);
                            }
                        });
                    });
                });

                Promise.all(insertPromises)
                    .then(() => {
                        // Commit transaction if all inserts are successful
                        this.db.run('COMMIT', (commitErr: Error) => {
                            if (commitErr) {
                                return reject("Failed to commit transaction:" + commitErr);
                            }
                            resolve(insertedIds);
                        });
                    })
                    .catch((error) => {
                        // Rollback transaction if any insert fails
                        this.db.run('ROLLBACK', (rollbackErr: Error) => {
                            if (rollbackErr) {
                                reject("Failed to rollback transaction:" + rollbackErr);
                            } else {
                                reject("Transaction rolled back due to error:" + error);
                            }

                        });
                    });
            });
        });
    }

    async getOne(sample: MinimalSampleRequestModel): Promise<PublicSampleModel | null> {
        //can be search by sample_id, by sample_name and project_id
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(sample)) {
            params.push(value)
            placeholders = placeholders + "sample." + key + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);

        // if no params, return null
        if (params.length == 0) {
            return null
        }

        // form final sql
        const sql = `SELECT sample.*, user.first_name, user.last_name, user.email, sample_type.sample_type_label, ecotaxa_import_status.ecotaxa_import_status_label, visual_quality_check_status.visual_qc_status_label FROM sample LEFT JOIN sample_type ON sample.sample_type_id = sample_type.sample_type_id LEFT JOIN visual_quality_check_status on sample.visual_qc_status_id = visual_quality_check_status.visual_qc_status_id LEFT JOIN user on sample.visual_qc_validator_user_id=user.user_id LEFT JOIN ecotaxa_import_status ON sample.ecotaxa_import_status_id = ecotaxa_import_status.ecotaxa_import_status_id WHERE ` + placeholders + `LIMIT 1;`;
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
                            sample_id: row.sample_id,
                            sample_name: row.sample_name,
                            comment: row.comment,
                            instrument_serial_number: row.instrument_serial_number,
                            optional_structure_id: row.optional_structure_id,
                            max_pressure: row.max_pressure,
                            station_id: row.station_id,
                            sampling_date: row.sampling_date,
                            latitude: row.latitude,
                            longitude: row.longitude,
                            wind_direction: row.wind_direction,
                            wind_speed: row.wind_speed,
                            sea_state: row.sea_state,
                            nebulousness: row.nebulousness,
                            bottom_depth: row.bottom_depth,
                            instrument_operator_email: row.instrument_operator_email,
                            filename: row.filename,
                            sample_creation_date: row.sample_creation_date,
                            filter_first_image: row.filter_first_image,
                            filter_last_image: row.filter_last_image,
                            instrument_settings_acq_gain: row.instrument_settings_acq_gain,
                            instrument_settings_acq_description: row.instrument_settings_acq_description,
                            instrument_settings_acq_task_type: row.instrument_settings_acq_task_type,
                            instrument_settings_acq_choice: row.instrument_settings_acq_choice,
                            instrument_settings_acq_disk_type: row.instrument_settings_acq_disk_type,
                            instrument_settings_acq_appendices_ratio: row.instrument_settings_acq_appendices_ratio,
                            instrument_settings_acq_xsize: row.instrument_settings_acq_xsize,
                            instrument_settings_acq_ysize: row.instrument_settings_acq_ysize,
                            instrument_settings_acq_erase_border: row.instrument_settings_acq_erase_border,
                            instrument_settings_acq_threshold: row.instrument_settings_acq_threshold,
                            instrument_settings_process_datetime: row.instrument_settings_process_datetime,
                            instrument_settings_process_gamma: row.instrument_settings_process_gamma,
                            instrument_settings_images_post_process: row.instrument_settings_images_post_process,
                            instrument_settings_aa: row.instrument_settings_aa,
                            instrument_settings_exp: row.instrument_settings_exp,
                            instrument_settings_image_volume_l: row.instrument_settings_image_volume_l,
                            instrument_settings_pixel_size_mm: row.instrument_settings_pixel_size_mm,
                            instrument_settings_depth_offset_m: row.instrument_settings_depth_offset_m,
                            instrument_settings_particle_minimum_size_pixels: row.instrument_settings_particle_minimum_size_pixels,
                            instrument_settings_vignettes_minimum_size_pixels: row.instrument_settings_vignettes_minimum_size_pixels,
                            instrument_settings_particle_minimum_size_esd: row.instrument_settings_particle_minimum_size_esd,
                            instrument_settings_vignettes_minimum_size_esd: row.instrument_settings_vignettes_minimum_size_esd,
                            instrument_settings_acq_shutter: row.instrument_settings_acq_shutter_speed,
                            instrument_settings_acq_shutter_speed: row.instrument_settings_acq_shutter_speed,
                            instrument_settings_acq_exposure: row.instrument_settings_acq_exposure,
                            visual_qc_validator_user_id: row.visual_qc_validator_user_id,
                            visual_qc_validator_user: row.user_first_name + " " + row.user_last_name + " (" + row.email + ")", // Doe John (john.doe@mail.com)
                            visual_qc_status_id: row.visual_qc_status_id,
                            visual_qc_status_label: row.visual_qc_status_label,
                            sample_type_id: row.sample_type_id,
                            sample_type_label: row.sample_type_label,
                            project_id: row.project_id,
                            ecotaxa_sample_imported: row.ecotaxa_sample_imported,
                            ecotaxa_sample_import_date: row.ecotaxa_sample_import_date,
                            ecotaxa_sample_id: row.ecotaxa_sample_id,
                            ecotaxa_sample_tsv_file_name: row.ecotaxa_sample_tsv_file_name,
                            ecotaxa_sample_local_folder_tsv_path: row.ecotaxa_sample_local_folder_tsv_path,
                            ecotaxa_sample_nb_images: row.ecotaxa_sample_nb_images,
                            ecotaxa_import_status_id: row.ecotaxa_import_status_id,
                            ecotaxa_import_status_label: row.ecotaxa_import_status_label,
                            ecotaxa_sample_task_id: row.ecotaxa_sample_task_id
                        };
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
        const sql = `UPDATE sample SET ecotaxa_sample_imported = 0, ecotaxa_sample_import_date = NULL, ecotaxa_sample_id = NULL, ecotaxa_sample_tsv_file_name = NULL, ecotaxa_sample_local_folder_tsv_path = NULL, ecotaxa_sample_nb_images = NULL, ecotaxa_import_status_id = NULL, ecotaxa_sample_task_id = NULL WHERE sample_id = (?)`;
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
        let sql = `SELECT sample.*, user.first_name, user.last_name, user.email, sample_type.sample_type_label, visual_quality_check_status.visual_qc_status_label, (SELECT COUNT(*) FROM sample`
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
                // If value is true or false, set to 1 or 0
                else if (filter.value == true || filter.value == "true") {
                    filtering_sql += `sample.` + filter.field + ` = 1`;
                }
                else if (filter.value == false || filter.value == "false") {
                    filtering_sql += `sample.` + filter.field + ` = 0`;
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
        LEFT JOIN user
            ON sample.visual_qc_validator_user_id = user.user_id
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
                        items: rows.map(row => ({
                            sample_id: row.sample_id,
                            sample_name: row.sample_name,
                            comment: row.comment,
                            instrument_serial_number: row.instrument_serial_number,
                            optional_structure_id: row.optional_structure_id,
                            max_pressure: row.max_pressure,
                            station_id: row.station_id,
                            sampling_date: row.sampling_date,
                            latitude: row.latitude,
                            longitude: row.longitude,
                            wind_direction: row.wind_direction,
                            wind_speed: row.wind_speed,
                            sea_state: row.sea_state,
                            nebulousness: row.nebulousness,
                            bottom_depth: row.bottom_depth,
                            instrument_operator_email: row.instrument_operator_email,
                            filename: row.filename,
                            sample_creation_date: row.sample_creation_date,
                            filter_first_image: row.filter_first_image,
                            filter_last_image: row.filter_last_image,
                            instrument_settings_acq_gain: row.instrument_settings_acq_gain,
                            instrument_settings_acq_description: row.instrument_settings_acq_description,
                            instrument_settings_acq_task_type: row.instrument_settings_acq_task_type,
                            instrument_settings_acq_choice: row.instrument_settings_acq_choice,
                            instrument_settings_acq_disk_type: row.instrument_settings_acq_disk_type,
                            instrument_settings_acq_appendices_ratio: row.instrument_settings_acq_appendices_ratio,
                            instrument_settings_acq_xsize: row.instrument_settings_acq_xsize,
                            instrument_settings_acq_ysize: row.instrument_settings_acq_ysize,
                            instrument_settings_acq_erase_border: row.instrument_settings_acq_erase_border,
                            instrument_settings_acq_threshold: row.instrument_settings_acq_threshold,
                            instrument_settings_process_datetime: row.instrument_settings_process_datetime,
                            instrument_settings_process_gamma: row.instrument_settings_process_gamma,
                            instrument_settings_images_post_process: row.instrument_settings_images_post_process,
                            instrument_settings_aa: row.instrument_settings_aa,
                            instrument_settings_exp: row.instrument_settings_exp,
                            instrument_settings_image_volume_l: row.instrument_settings_image_volume_l,
                            instrument_settings_pixel_size_mm: row.instrument_settings_pixel_size_mm,
                            instrument_settings_depth_offset_m: row.instrument_settings_depth_offset_m,
                            instrument_settings_particle_minimum_size_pixels: row.instrument_settings_particle_minimum_size_pixels,
                            instrument_settings_vignettes_minimum_size_pixels: row.instrument_settings_vignettes_minimum_size_pixels,
                            instrument_settings_particle_minimum_size_esd: row.instrument_settings_particle_minimum_size_esd,
                            instrument_settings_vignettes_minimum_size_esd: row.instrument_settings_vignettes_minimum_size_esd,
                            instrument_settings_acq_shutter: row.instrument_settings_acq_shutter_speed,
                            instrument_settings_acq_shutter_speed: row.instrument_settings_acq_shutter_speed,
                            instrument_settings_acq_exposure: row.instrument_settings_acq_exposure,
                            visual_qc_validator_user_id: row.visual_qc_validator_user_id,
                            visual_qc_validator_user: row.user_first_name + " " + row.user_last_name + " (" + row.email + ")", // Doe John (john.doe@mail.com)
                            visual_qc_status_id: row.visual_qc_status_id,
                            visual_qc_status_label: row.visual_qc_status_label,
                            sample_type_id: row.sample_type_id,
                            sample_type_label: row.sample_type_label,
                            project_id: row.project_id,
                            ecotaxa_sample_imported: row.ecotaxa_sample_imported,
                            ecotaxa_sample_import_date: row.ecotaxa_sample_import_date,
                            ecotaxa_sample_id: row.ecotaxa_sample_id,
                            ecotaxa_sample_tsv_file_name: row.ecotaxa_sample_tsv_file_name,
                            ecotaxa_sample_local_folder_tsv_path: row.ecotaxa_sample_local_folder_tsv_path,
                            ecotaxa_sample_nb_images: row.ecotaxa_sample_nb_images,
                            ecotaxa_import_status_id: row.ecotaxa_import_status_id,
                            ecotaxa_import_status_label: row.ecotaxa_import_status_label,
                            ecotaxa_sample_task_id: row.ecotaxa_sample_task_id
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
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
            placeholders = placeholders + key + "=(?),"
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

    async getSampleType(sampleType: SampleTypeRequestModel): Promise<SampleTypeModel | null> {
        //can be search by sample_type_id, sample_type_label, sample_type_description
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(sampleType)) {
            params.push(value)
            placeholders = placeholders + key + "=(?) AND "
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
            placeholders = placeholders + key + "=(?) AND "
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
            placeholders = placeholders + key + "=(?) AND "
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

