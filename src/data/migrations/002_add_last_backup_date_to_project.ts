import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

export const migration: Migration = {
    id: "002_add_last_backup_date_to_project",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `ALTER TABLE project ADD COLUMN last_backup_date TIMESTAMP DEFAULT NULL;`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // SQLite does not support DROP COLUMN before version 3.35.
        // Recreate the project table without the last_backup_date column.
        await runSQL(db, "PRAGMA foreign_keys = OFF;");

        await runSQL(db, `ALTER TABLE project RENAME TO project_old;`);

        await runSQL(db, `
            CREATE TABLE project (
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

        await runSQL(db, `
            INSERT INTO project
                (project_id, root_folder_path, project_title, project_acronym, project_description,
                 project_information, cruise, ship, data_owner_name, data_owner_email,
                 operator_name, operator_email, chief_scientist_name, chief_scientist_email,
                 override_depth_offset, enable_descent_filter, privacy_duration, visible_duration,
                 public_duration, instrument_model, serial_number, ecotaxa_project_id,
                 ecotaxa_project_name, ecotaxa_instance_id, project_creation_date)
            SELECT
                project_id, root_folder_path, project_title, project_acronym, project_description,
                project_information, cruise, ship, data_owner_name, data_owner_email,
                operator_name, operator_email, chief_scientist_name, chief_scientist_email,
                override_depth_offset, enable_descent_filter, privacy_duration, visible_duration,
                public_duration, instrument_model, serial_number, ecotaxa_project_id,
                ecotaxa_project_name, ecotaxa_instance_id, project_creation_date
            FROM project_old;
        `);

        await runSQL(db, `DROP TABLE project_old;`);
        await runSQL(db, "PRAGMA foreign_keys = ON;");
    }
};
