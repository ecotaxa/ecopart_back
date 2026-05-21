import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

export const migration: Migration = {
    id: "005_make_gamma_nullable",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        // SQLite does not support ALTER COLUMN, so we recreate the table.
        await runSQL(db, `PRAGMA foreign_keys = OFF;`);

        await runSQL(db, `
            CREATE TABLE 'sample_new' (
                sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sample_name TEXT NOT NULL,
                comment TEXT NOT NULL,
                instrument_serial_number TEXT NOT NULL,
                optional_structure_id TEXT,
                max_pressure INTEGER NOT NULL,
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
                instrument_settings_acq_task_type INTEGER,
                instrument_settings_acq_choice INTEGER,
                instrument_settings_acq_disk_type INTEGER,
                instrument_settings_acq_appendices_ratio INTEGER NOT NULL,
                instrument_settings_acq_xsize INTEGER,
                instrument_settings_acq_ysize INTEGER,
                instrument_settings_acq_erase_border INTEGER,
                instrument_settings_acq_threshold INTEGER NOT NULL,
                instrument_settings_process_datetime TEXT,
                instrument_settings_process_gamma INTEGER,
                instrument_settings_images_post_process TEXT NOT NULL,
                instrument_settings_aa INTEGER NOT NULL,
                instrument_settings_exp INTEGER NOT NULL,
                instrument_settings_image_volume_l INTEGER NOT NULL,
                instrument_settings_pixel_size_mm INTEGER NOT NULL,
                instrument_settings_depth_offset_m INTEGER,
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
                ecotaxa_import_status_id INTEGER,
                ecotaxa_sample_imported BOOLEAN NOT NULL DEFAULT 0,
                ecotaxa_sample_import_date TIMESTAMP,
                ecotaxa_sample_id INTEGER,
                ecotaxa_sample_tsv_file_name TEXT,
                ecotaxa_sample_local_folder_tsv_path TEXT,
                ecotaxa_sample_nb_images INTEGER,
                ecotaxa_sample_task_id INTEGER,
                ctd_imported BOOLEAN NOT NULL DEFAULT 0,
                ctd_station_id TEXT,
                ctd_file_extension TEXT,
                ctd_import_date TEXT,
                nb_vignettes INTEGER NOT NULL DEFAULT 0,

                FOREIGN KEY (visual_qc_validator_user_id) REFERENCES user(user_id),
                FOREIGN KEY (visual_qc_status_id) REFERENCES visual_quality_check_status(visual_qc_status_id),
                FOREIGN KEY (sample_type_id) REFERENCES sample_type(sample_type_id),
                FOREIGN KEY (project_id) REFERENCES project(project_id),
                FOREIGN KEY (ecotaxa_import_status_id) REFERENCES ecotaxa_import_status(ecotaxa_import_status_id),
                CONSTRAINT Unique_proj_id_sample_name UNIQUE (project_id, sample_name)
            );
        `);

        await runSQL(db, `INSERT INTO sample_new SELECT * FROM sample;`);
        await runSQL(db, `DROP TABLE sample;`);
        await runSQL(db, `ALTER TABLE sample_new RENAME TO sample;`);

        await runSQL(db, `PRAGMA foreign_keys = ON;`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
    },
};
