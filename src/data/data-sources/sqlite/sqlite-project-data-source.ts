import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";

import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel } from "../../../domain/entities/project";
import { ProjectDataSource } from "../../interfaces/data-sources/project-data-source";

// const DB_TABLE = "project"
export class SQLiteProjectDataSource implements ProjectDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_project_db()
    }

    init_project_db() {
        // Create table if not exist
        const sql_create = "CREATE TABLE IF NOT EXISTS 'project' (project_id INTEGER PRIMARY KEY AUTOINCREMENT, root_folder_path TEXT NOT NULL, project_title TEXT NOT NULL, project_acronym TEXT NOT NULL, project_description TEXT, project_information TEXT, cruise TEXT NOT NULL, ship TEXT NOT NULL, data_owner_name TEXT NOT NULL, data_owner_email TEXT NOT NULL, operator_name TEXT NOT NULL, operator_email TEXT NOT NULL, chief_scientist_name TEXT NOT NULL, chief_scientist_email TEXT NOT NULL, override_depth_offset REAL, enable_descent_filter BOOLEAN NOT NULL, privacy_duration INTEGER NOT NULL, visible_duration INTEGER NOT NULL, public_duration INTEGER NOT NULL, instrument TEXT NOT NULL, project_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);"

        this.db.run(sql_create, [], function (err) {
            if (err) {
                console.log("DB error--", err)
            }
        })
    }

    async create(project: ProjectRequestCreationtModel): Promise<number> {
        const params = [project.root_folder_path, project.project_title, project.project_acronym, project.project_description, project.cruise, project.ship, project.data_owner_name, project.data_owner_email, project.operator_name, project.operator_email, project.chief_scientist_name, project.chief_scientist_email, project.override_depth_offset, project.enable_descent_filter, project.privacy_duration, project.visible_duration, project.public_duration, project.instrument]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO project (root_folder_path, project_title, project_acronym, project_description, cruise, ship, data_owner_name, data_owner_email, operator_name, operator_email, chief_scientist_name, chief_scientist_email, override_depth_offset, enable_descent_filter, privacy_duration, visible_duration, public_duration, instrument) VALUES  (` + placeholders + `);`;

        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    if (err.message == "SQLITE_CONSTRAINT: UNIQUE constraint failed: user.email")
                        console.log("DB error--", err)
                    reject(err);
                } else {
                    const result = this.lastID;
                    resolve(result);
                }
            });
        })
    }


    async getOne(project: ProjectRequestModel): Promise<ProjectResponseModel | null> {
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(project)) {
            params.push(value)
            placeholders = placeholders + key + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);
        // form final sql
        const sql = `SELECT * FROM project WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) resolve(null);
                    else {
                        const result = {
                            project_id: row.project_id,
                            root_folder_path: row.root_folder_path,
                            project_title: row.project_title,
                            project_acronym: row.project_acronym,
                            project_description: row.project_description,
                            project_information: row.project_information,
                            cruise: row.cruise,
                            ship: row.ship,
                            data_owner_name: row.data_owner_name,
                            data_owner_email: row.data_owner_email,
                            operator_name: row.operator_name,
                            operator_email: row.operator_email,
                            chief_scientist_name: row.chief_scientist_name,
                            chief_scientist_email: row.chief_scientist_email,
                            override_depth_offset: row.override_depth_offset,
                            enable_descent_filter: row.enable_descent_filter == 1 ? true : false,
                            privacy_duration: row.privacy_duration,
                            visible_duration: row.visible_duration,
                            public_duration: row.public_duration,
                            instrument: row.instrument,
                            project_creation_date: row.project_creation_date
                        };
                        resolve(result);
                    }
                }
            });
        })
    }

    async deleteOne(project: ProjectRequestModel): Promise<number> {
        // delete project based on project_id
        const sql = `DELETE FROM project WHERE project_id = (?)`;
        return await new Promise((resolve, reject) => {
            this.db.run(sql, [project.project_id], function (err) {
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

}

