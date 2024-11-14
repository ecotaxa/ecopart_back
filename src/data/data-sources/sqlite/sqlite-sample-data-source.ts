import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
//SampleRequestModel, SampleUpdateModel, SampleResponseModel 
import { MinimalSampleRequestModel, PrivateSampleUpdateModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleTypeModel, SampleTypeRequestModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel, } from "../../../domain/entities/sample";
import { SampleDataSource } from "../../interfaces/data-sources/sample-data-source";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
//import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// const DB_TABLE = "sample"
export class SQLiteSampleDataSource implements SampleDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_sample_db()
    }

    init_sample_db(): void {
        this.createSampleTypeTable()
        this.createVisualQualityCheckTable()
        this.createSampleTable()
    }

    createSampleTypeTable(): void {
        // SQL statement to create the sample_type table if it does not exist
        const sql_sample_type = `
            CREATE TABLE IF NOT EXISTS sample_type (
                sample_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sample_type_label TEXT NOT NULL,
                sample_type_description TEXT NOT NULL
            );
        `;

        // Run the SQL query to create the table
        const db_tables = this.db;
        db_tables.run(sql_sample_type, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            } else {
                // Insert default task_type
                const sql_admin = `
                    INSERT OR IGNORE INTO sample_type (sample_type_label, sample_type_description) 
                    VALUES 
                        ('Time', 'Time série'),
                        ('Depth', 'Depth profile');
                `;

                db_tables.run(sql_admin, [], function (err: Error | null) {
                    if (err) {
                        console.log("DB error--", err);
                    }
                });
            }
        });
    }

    createVisualQualityCheckTable(): void {
        // SQL statement to create the visual_quality_check_status table if it does not exist
        const sql_sample_visual_quality_check_status = `
            CREATE TABLE IF NOT EXISTS visual_quality_check_status (
                visual_qc_status_id INTEGER PRIMARY KEY AUTOINCREMENT,
                visual_qc_status_label TEXT NOT NULL
            );
        `;

        // Run the SQL query to create the table
        const db_tables = this.db;
        db_tables.run(sql_sample_visual_quality_check_status, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            } else {
                // Insert default visual_quality_check_status entries
                const sql_admin = `
                    INSERT OR IGNORE INTO visual_quality_check_status (visual_qc_status_label) 
                    VALUES 
                        ('PENDING'),
                        ('VALIDATED'),
                        ('REJECTED');  // Removed the trailing comma and added a semicolon
                `;

                db_tables.run(sql_admin, [], function (err: Error | null) {
                    if (err) {
                        console.log("DB error--", err);
                    }
                });
            }
        });
    }

    createSampleTable(): void {
        // SQL statement to create the sample table if it does not exist
        const sql_create_sample = `
    CREATE TABLE IF NOT EXISTS 'sample' (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_name TEXT NOT NULL,
        comment TEXT NOT NULL,
        instrument_serial_number TEXT NOT NULL,
        optional_structure_id TEXT,
        max_pressure INTEGER NOT NULL,
        integration_time INTEGER,
        station_id TEXT NOT NULL,
        sampling_date TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        wind_direction INTEGER,
        wind_speed INTEGER,
        sea_state TEXT,
        nebulousness INTEGER,
        bottom_depth INTEGER,
        instrument_operator_email TEXT NOT NULL,
        filename TEXT NOT NULL,
        sample_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        filter_first_image TEXT NOT NULL,
        filter_last_image TEXT NOT NULL,

        instrument_settings_acq_gain INTEGER NOT NULL,
        instrument_settings_acq_description TEXT,
        instrument_settings_acq_task_type TEXT,
        instrument_settings_acq_choice TEXT,
        instrument_settings_acq_disk_type TEXT,
        instrument_settings_acq_appendices_ratio INTEGER NOT NULL,
        instrument_settings_acq_xsize INTEGER,
        instrument_settings_acq_ysize INTEGER,
        instrument_settings_acq_erase_border INTEGER,
        instrument_settings_acq_threshold INTEGER NOT NULL,
        instrument_settings_process_datetime TEXT,
        instrument_settings_process_gamma INTEGER NOT NULL,
        instrument_settings_images_post_process TEXT NOT NULL,
        instrument_settings_aa INTEGER NOT NULL,
        instrument_settings_exp INTEGER NOT NULL,
        instrument_settings_image_volume_l INTEGER NOT NULL,
        instrument_settings_pixel_size_mm INTEGER NOT NULL,
        instrument_settings_depth_offset_m INTEGER NOT NULL,
        instrument_settings_particle_minimum_size_pixels INTEGER,
        instrument_settings_vignettes_minimum_size_pixels INTEGER,
        instrument_settings_particle_minimum_size_esd INTEGER,
        instrument_settings_vignettes_minimum_size_esd INTEGER,
        instrument_settings_acq_shutter_speed INTEGER,
        instrument_settings_acq_exposure INTEGER,
        instrument_settings_acq_shutter INTEGER,

        visual_qc_validator_user_id INTEGER NOT NULL,
        visual_qc_status_id INTEGER NOT NULL DEFAULT 1,
        sample_type_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,

        FOREIGN KEY (visual_qc_validator_user_id) REFERENCES user(user_id),
        FOREIGN KEY (visual_qc_status_id) REFERENCES visual_quality_check_status(visual_qc_status_id)
        FOREIGN KEY (sample_type_id) REFERENCES sample_type(sample_type_id),
        FOREIGN KEY (project_id) REFERENCES project(project_id)

        CONSTRAINT Unique_proj_id_sample_name UNIQUE (project_id, sample_name)
    );
    `;
        // Run the SQL query to create the table
        this.db.run(sql_create_sample, [], (err: Error | null) => {
            if (err) {
                console.error("Error creating the 'sample' table:", err.message);
                return; // Return early if there's an error creating the table
            }
        });
    }

    async createOne(sample: SampleRequestCreationModel): Promise<number> {
        const params = [sample.sample_name, sample.comment, sample.instrument_serial_number, sample.optional_structure_id, sample.max_pressure, sample.integration_time, sample.station_id, sample.sampling_date, sample.latitude, sample.longitude, sample.wind_direction, sample.wind_speed, sample.sea_state, sample.nebulousness, sample.bottom_depth, sample.instrument_operator_email, sample.filename, sample.filter_first_image, sample.filter_last_image, sample.instrument_settings_acq_gain, sample.instrument_settings_acq_description, sample.instrument_settings_acq_task_type, sample.instrument_settings_acq_choice, sample.instrument_settings_acq_disk_type, sample.instrument_settings_acq_appendices_ratio, sample.instrument_settings_acq_xsize, sample.instrument_settings_acq_ysize, sample.instrument_settings_acq_erase_border, sample.instrument_settings_acq_threshold, sample.instrument_settings_process_datetime, sample.instrument_settings_process_gamma, sample.instrument_settings_images_post_process, sample.instrument_settings_aa, sample.instrument_settings_exp, sample.instrument_settings_image_volume_l, sample.instrument_settings_pixel_size_mm, sample.instrument_settings_depth_offset_m, sample.instrument_settings_particle_minimum_size_pixels, sample.instrument_settings_vignettes_minimum_size_pixels, sample.instrument_settings_particle_minimum_size_esd, sample.instrument_settings_vignettes_minimum_size_esd, sample.instrument_settings_acq_shutter, sample.instrument_settings_acq_shutter_speed, sample.instrument_settings_acq_exposure, sample.visual_qc_validator_user_id, sample.sample_type_id, sample.project_id]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO sample (sample_name, comment, instrument_serial_number, optional_structure_id, max_pressure, integration_time, station_id, sampling_date, latitude, longitude, wind_direction, wind_speed, sea_state, nebulousness, bottom_depth, instrument_operator_email, filename, filter_first_image, filter_last_image, instrument_settings_acq_gain, instrument_settings_acq_description, instrument_settings_acq_task_type, instrument_settings_acq_choice, instrument_settings_acq_disk_type, instrument_settings_acq_appendices_ratio, instrument_settings_acq_xsize, instrument_settings_acq_ysize, instrument_settings_acq_erase_border, instrument_settings_acq_threshold, instrument_settings_process_datetime, instrument_settings_process_gamma, instrument_settings_images_post_process, instrument_settings_aa, instrument_settings_exp, instrument_settings_image_volume_l, instrument_settings_pixel_size_mm, instrument_settings_depth_offset_m, instrument_settings_particle_minimum_size_pixels, instrument_settings_vignettes_minimum_size_pixels, instrument_settings_particle_minimum_size_esd, instrument_settings_vignettes_minimum_size_esd, instrument_settings_acq_shutter, instrument_settings_acq_shutter_speed, instrument_settings_acq_exposure, visual_qc_validator_user_id, sample_type_id, project_id
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
                    console.log("Failed to begin transaction:", beginErr);
                    return reject(beginErr);
                }

                const insertPromises = samples.map((sample) => {
                    return new Promise<number>((resolveInsert, rejectInsert) => {
                        const params = [
                            sample.sample_name, sample.comment, sample.instrument_serial_number,
                            sample.optional_structure_id, sample.max_pressure, sample.integration_time, sample.station_id,
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
                            integration_time, station_id, sampling_date, latitude, longitude, wind_direction, wind_speed, sea_state, 
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
                                console.log("Failed to insert sample:", err);
                                rejectInsert(err);
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
                                console.log("Failed to commit transaction:", commitErr);
                                return reject(commitErr);
                            }
                            resolve(insertedIds);
                        });
                    })
                    .catch((error) => {
                        // Rollback transaction if any insert fails
                        this.db.run('ROLLBACK', (rollbackErr: Error) => {
                            if (rollbackErr) {
                                console.log("Failed to rollback transaction:", rollbackErr);
                            } else {
                                console.log("Transaction rolled back due to error:", error);
                            }
                            reject(error);
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
        const sql = `SELECT sample.*, user.first_name, user.last_name, user.email, sample_type.sample_type_label, visual_quality_check_status.visual_qc_status_label FROM sample LEFT JOIN sample_type ON sample.sample_type_id = sample_type.sample_type_id LEFT JOIN visual_quality_check_status on sample.visual_qc_status_id = visual_quality_check_status.visual_qc_status_id LEFT JOIN user on sample.visual_qc_validator_user_id=user.user_id WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) resolve(null);
                    else {
                        const result = {
                            sample_id: row.sample_id,
                            sample_name: row.sample_name,
                            comment: row.comment,
                            instrument_serial_number: row.instrument_serial_number,
                            optional_structure_id: row.optional_structure_id,
                            max_pressure: row.max_pressure,
                            integration_time: row.integration_time,
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
                            project_id: row.project_id
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
                else if (filter.value == "null") {
                    if (filter.operator == "=") {
                        filtering_sql += `sample.` + filter.field + ` IS NULL`;
                    } else if (filter.operator == "!=") {
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

        sql += `) AS total_count FROM sample LEFT JOIN sample_type ON sample.sample_type_id = sample_type.sample_type_id LEFT JOIN visual_quality_check_status on sample.visual_qc_status_id = visual_quality_check_status.visual_qc_status_id LEFT JOIN user on sample.visual_qc_validator_user_id=user.user_id`


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
                            integration_time: row.integration_time,
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
                            project_id: row.project_id
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
            params.push(value)
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
                    if (row === undefined) resolve(null);
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
                    if (row === undefined) resolve(null);
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

