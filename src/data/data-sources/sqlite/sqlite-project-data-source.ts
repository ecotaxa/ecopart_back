import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";

import { ProjectRequestCreationModel, ProjectRequestModel, ProjectUpdateModel, ProjectResponseModel } from "../../../domain/entities/project";
import { ProjectDataSource } from "../../interfaces/data-sources/project-data-source";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// const DB_TABLE = "project"
export class SQLiteProjectDataSource implements ProjectDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_project_db()
    }

    init_project_db() {
        // Create table if not exist
        const sql_create = "CREATE TABLE IF NOT EXISTS 'project' (project_id INTEGER PRIMARY KEY AUTOINCREMENT, root_folder_path TEXT NOT NULL, project_title TEXT NOT NULL, project_acronym TEXT NOT NULL, project_description TEXT, project_information TEXT, cruise TEXT NOT NULL, ship TEXT NOT NULL, data_owner_name TEXT NOT NULL, data_owner_email TEXT NOT NULL, operator_name TEXT NOT NULL, operator_email TEXT NOT NULL, chief_scientist_name TEXT NOT NULL, chief_scientist_email TEXT NOT NULL, override_depth_offset REAL, enable_descent_filter BOOLEAN NOT NULL, privacy_duration INTEGER NOT NULL, visible_duration INTEGER NOT NULL, public_duration INTEGER NOT NULL, instrument_model INTEGER, serial_number TEXT NOT NULL, project_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (instrument_model) REFERENCES instrument_model(instrument_model_id));"

        this.db.run(sql_create, [], function (err) {
            if (err) {
                console.log("DB error--", err)
            }
        })
    }

    async create(project: ProjectRequestCreationModel): Promise<number> {
        const params = [project.root_folder_path, project.project_title, project.project_acronym, project.project_description, project.project_information, project.cruise, project.ship, project.data_owner_name, project.data_owner_email, project.operator_name, project.operator_email, project.chief_scientist_name, project.chief_scientist_email, project.override_depth_offset, project.enable_descent_filter, project.privacy_duration, project.visible_duration, project.public_duration, project.instrument_model, project.serial_number]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO project (root_folder_path, project_title, project_acronym, project_description, project_information, cruise, ship, data_owner_name, data_owner_email, operator_name, operator_email, chief_scientist_name, chief_scientist_email, override_depth_offset, enable_descent_filter, privacy_duration, visible_duration, public_duration, instrument_model, serial_number) VALUES  (` + placeholders + `);`;

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
        const sql = `SELECT project.* , instrument_model.instrument_model_name FROM project LEFT JOIN instrument_model ON project.instrument_model = instrument_model.instrument_model_id WHERE ` + placeholders + `LIMIT 1;`;
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
                            instrument_model: row.instrument_model_name,
                            serial_number: row.serial_number,
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

    // Returns the number of lines updates
    updateOne(project: ProjectUpdateModel): Promise<number> {
        const { project_id, ...projectData } = project; // Destructure the project object

        const params: any[] = []
        let placeholders: string = ""
        for (const [key, value] of Object.entries(projectData)) {
            if (key == "enable_descent_filter") { // TODO somewhere else? serializer?
                params.push(value == true || value == "true" ? 1 : 0) // TODO clean
            } else {
                params.push(value)
            }
            placeholders = placeholders + key + "=(?),"
        }
        placeholders = placeholders.slice(0, -1);
        params.push(project_id)

        const sql = `UPDATE project SET ` + placeholders + ` WHERE project_id=(?);`;
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.log("DB error--", err)
                    reject(err);
                } else {
                    const result = this.changes //RETURN NB OF CHANGES
                    resolve(result);
                }
            });
        })
    }
    async getAll(options: PreparedSearchOptions): Promise<SearchResult<ProjectResponseModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT project.*, instrument_model.instrument_model_name, (SELECT COUNT(*) FROM project`
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
                        filtering_sql += filter.field + ` IN (` + filter.value.map(() => '(?)').join(',') + `) `
                        params_filtering.push(...filter.value)
                    }
                }
                // If value is true or false, set to 1 or 0
                else if (filter.value == true || filter.value == "true") {
                    filtering_sql += filter.field + ` = 1`;
                }
                else if (filter.value == false || filter.value == "false") {
                    filtering_sql += filter.field + ` = 0`;
                }
                // If value is undefined, null or empty, and operator =, set to is null
                else if (filter.value == undefined || filter.value == null || filter.value == "") {
                    if (filter.operator == "=") {
                        filtering_sql += filter.field + ` IS NULL`;
                    } else if (filter.operator == "!=") {
                        filtering_sql += filter.field + ` IS NOT NULL`;
                    }
                }

                else {
                    filtering_sql += filter.field + ` ` + filter.operator + ` (?)`
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

        sql += `) AS total_count FROM project LEFT JOIN instrument_model ON project.instrument_model = instrument_model.instrument_model_id`


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
                    const result: SearchResult<ProjectResponseModel> = {
                        items: rows.map(row => ({
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
                            instrument_model: row.instrument_model_name,
                            serial_number: row.serial_number,
                            project_creation_date: row.project_creation_date
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }


}

