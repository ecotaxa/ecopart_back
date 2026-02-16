import { Migration } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

/**
 * Initial migration — captures the full existing schema so that:
 *  - New databases are created from scratch via migrations
 *  - Existing databases simply record this migration as applied (tables already exist)
 *
 * Uses CREATE TABLE IF NOT EXISTS so it is safe to run on an existing database.
 */

function runSQL(db: SQLiteDatabaseWrapper, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

export const migration: Migration = {
    id: "000_initial_schema",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {

        // ─── instrument_model ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'instrument_model' (
                instrument_model_id INTEGER PRIMARY KEY AUTOINCREMENT,
                instrument_model_name TEXT NOT NULL UNIQUE,
                bodc_url TEXT NOT NULL,
                instrument_model_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed instrument models
        const instrumentModels = [
            { name: "UVP5HD", url: "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/" },
            { name: "UVP5SD", url: "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/" },
            { name: "UVP5Z", url: "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/" },
            { name: "UVP6LP", url: "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/" },
            { name: "UVP6HF", url: "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/" },
            { name: "UVP6MHP", url: "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/" },
            { name: "UVP6MHF", url: "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/" },
        ];
        for (const im of instrumentModels) {
            await runSQL(db,
                "INSERT OR IGNORE INTO instrument_model (instrument_model_name, bodc_url) VALUES (?, ?);",
                [im.name, im.url]
            );
        }

        // ─── ecotaxa_instance ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS ecotaxa_instance (
                ecotaxa_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
                ecotaxa_instance_name TEXT UNIQUE NOT NULL,
                ecotaxa_instance_description TEXT NOT NULL,
                ecotaxa_instance_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ecotaxa_instance_url TEXT UNIQUE NOT NULL
            );
        `);

        // Seed ecotaxa instances
        await runSQL(db,
            "INSERT OR IGNORE INTO ecotaxa_instance (ecotaxa_instance_name, ecotaxa_instance_description, ecotaxa_instance_url) VALUES (?, ?, ?);",
            ["FR", "French ecotaxa instance", "https://ecotaxa.obs-vlfr.fr/"]
        );

        // ─── user ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'user' (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash CHAR(60) NOT NULL,
                valid_email BOOLEAN CHECK (valid_email IN (0, 1)) DEFAULT 0,
                confirmation_code TEXT,
                reset_password_code TEXT,
                is_admin BOOLEAN CHECK (is_admin IN (0, 1)) DEFAULT 0,
                organisation TEXT NOT NULL,
                country TEXT NOT NULL,
                user_planned_usage TEXT NOT NULL,
                user_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted TIMESTAMP DEFAULT NULL
            );
        `);

        // ─── project ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'project' (
                project_id INTEGER PRIMARY KEY AUTOINCREMENT,
                root_folder_path TEXT NOT NULL,
                project_title TEXT NOT NULL,
                project_acronym TEXT NOT NULL,
                project_description TEXT,
                project_information TEXT,
                cruise TEXT NOT NULL,
                ship TEXT NOT NULL,
                data_owner_name TEXT NOT NULL,
                data_owner_email TEXT NOT NULL,
                operator_name TEXT NOT NULL,
                operator_email TEXT NOT NULL,
                chief_scientist_name TEXT NOT NULL,
                chief_scientist_email TEXT NOT NULL,
                override_depth_offset REAL,
                enable_descent_filter BOOLEAN NOT NULL,
                privacy_duration INTEGER NOT NULL,
                visible_duration INTEGER NOT NULL,
                public_duration INTEGER NOT NULL,
                instrument_model INTEGER,
                serial_number TEXT NOT NULL,
                ecotaxa_project_id INTEGER,
                ecotaxa_project_name TEXT,
                ecotaxa_instance_id INTEGER,
                project_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(ecotaxa_project_id, ecotaxa_instance_id),
                FOREIGN KEY (instrument_model) REFERENCES instrument_model(instrument_model_id),
                FOREIGN KEY (ecotaxa_instance_id) REFERENCES ecotaxa_instance(ecotaxa_instance_id)
            );
        `);

        // ─── privilege ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'privilege' (
                privilege_id INTEGER PRIMARY KEY AUTOINCREMENT,
                privilege_name TEXT NOT NULL,
                user_id INTEGER,
                project_id INTEGER,
                privilege_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                contact BOOLEAN CHECK (contact IN (0, 1)) DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE CASCADE
            );
        `);

        // ─── task_status ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'task_status' (
                task_status_id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_status_label TEXT UNIQUE NOT NULL
            );
        `);

        const taskStatuses = ["PENDING", "VALIDATING", "RUNNING", "WAITING_FOR_RESPONSE", "DONE", "ERROR"];
        for (const status of taskStatuses) {
            await runSQL(db,
                "INSERT OR IGNORE INTO task_status (task_status_label) VALUES (?);",
                [status]
            );
        }

        // ─── task_type ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'task_type' (
                task_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_type_label TEXT UNIQUE NOT NULL
            );
        `);

        const taskTypes = ["EXPORT", "EXPORT_BACKUP", "DELETE", "UPDATE", "IMPORT", "IMPORT_BACKUP", "IMPORT_CTD", "IMPORT_ECO_TAXA"];
        for (const type of taskTypes) {
            await runSQL(db,
                "INSERT OR IGNORE INTO task_type (task_type_label) VALUES (?);",
                [type]
            );
        }

        // ─── task ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'task' (
                task_id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_type_id INTEGER NOT NULL,
                task_status_id INTEGER NOT NULL DEFAULT 1,
                task_owner_id INTEGER NOT NULL,
                task_project_id INTEGER,
                task_log_file_path TEXT,
                task_progress_pct INTEGER DEFAULT 0,
                task_progress_msg TEXT DEFAULT "Created",
                task_params TEXT,
                task_result TEXT,
                task_error TEXT,
                task_question TEXT,
                task_reply TEXT,
                task_step INTEGER DEFAULT 0,
                task_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                task_start_date TIMESTAMP,
                task_end_date TIMESTAMP,
                FOREIGN KEY (task_type_id) REFERENCES task_type(task_type_id),
                FOREIGN KEY (task_status_id) REFERENCES task_status(task_status_id),
                FOREIGN KEY (task_owner_id) REFERENCES user(user_id) ON DELETE CASCADE,
                FOREIGN KEY (task_project_id) REFERENCES project(project_id) ON DELETE CASCADE
            );
        `);

        // ─── sample_type ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS sample_type (
                sample_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
                sample_type_label TEXT UNIQUE NOT NULL,
                sample_type_description TEXT NOT NULL
            );
        `);

        await runSQL(db,
            "INSERT OR IGNORE INTO sample_type (sample_type_label, sample_type_description) VALUES (?, ?);",
            ["Time", "Time série"]
        );
        await runSQL(db,
            "INSERT OR IGNORE INTO sample_type (sample_type_label, sample_type_description) VALUES (?, ?);",
            ["Depth", "Depth profile"]
        );

        // ─── ecotaxa_import_status ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS ecotaxa_import_status (
                ecotaxa_import_status_id INTEGER PRIMARY KEY AUTOINCREMENT,
                ecotaxa_import_status_label TEXT UNIQUE NOT NULL
            );
        `);

        const importStatuses = ["IN_PROGRESS", "SUCCESS", "ERROR"];
        for (const status of importStatuses) {
            await runSQL(db,
                "INSERT OR IGNORE INTO ecotaxa_import_status (ecotaxa_import_status_label) VALUES (?);",
                [status]
            );
        }

        // ─── visual_quality_check_status ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS visual_quality_check_status (
                visual_qc_status_id INTEGER PRIMARY KEY AUTOINCREMENT,
                visual_qc_status_label TEXT UNIQUE NOT NULL
            );
        `);

        const vqcStatuses = ["PENDING", "VALIDATED", "REJECTED"];
        for (const status of vqcStatuses) {
            await runSQL(db,
                "INSERT OR IGNORE INTO visual_quality_check_status (visual_qc_status_label) VALUES (?);",
                [status]
            );
        }

        // ─── sample ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'sample' (
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
                instrument_settings_process_gamma INTEGER NOT NULL,
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

                FOREIGN KEY (visual_qc_validator_user_id) REFERENCES user(user_id),
                FOREIGN KEY (visual_qc_status_id) REFERENCES visual_quality_check_status(visual_qc_status_id),
                FOREIGN KEY (sample_type_id) REFERENCES sample_type(sample_type_id),
                FOREIGN KEY (project_id) REFERENCES project(project_id),
                FOREIGN KEY (ecotaxa_import_status_id) REFERENCES ecotaxa_import_status(ecotaxa_import_status_id),
                CONSTRAINT Unique_proj_id_sample_name UNIQUE (project_id, sample_name)
            );
        `);

        // ─── ecotaxa_account ───
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS 'ecotaxa_account' (
                ecotaxa_account_id INTEGER PRIMARY KEY AUTOINCREMENT,
                ecotaxa_account_ecotaxa_id INTEGER NOT NULL,
                ecotaxa_account_token TEXT NOT NULL,
                ecotaxa_account_user_name TEXT NOT NULL,
                ecotaxa_account_user_email TEXT NOT NULL,
                ecotaxa_account_expiration_date TIMESTAMP NOT NULL,
                ecotaxa_account_ecopart_user_id INTEGER NOT NULL,
                ecotaxa_account_instance_id INTEGER NOT NULL,
                ecotaxa_account_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ecotaxa_account_ecopart_user_id) REFERENCES user(user_id),
                FOREIGN KEY (ecotaxa_account_instance_id) REFERENCES ecotaxa_instance(ecotaxa_instance_id),
                UNIQUE (ecotaxa_account_instance_id, ecotaxa_account_user_email, ecotaxa_account_ecopart_user_id)
            );
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // Drop in reverse dependency order
        const tables = [
            "ecotaxa_account",
            "sample",
            "visual_quality_check_status",
            "ecotaxa_import_status",
            "sample_type",
            "task",
            "task_type",
            "task_status",
            "privilege",
            "project",
            "user",
            "ecotaxa_instance",
            "instrument_model",
        ];

        for (const table of tables) {
            await runSQL(db, `DROP TABLE IF EXISTS '${table}';`);
        }
    },
};
