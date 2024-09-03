import { TaskDataSource } from "../../interfaces/data-sources/task-data-source";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
import { PrivateTaskRequestModel, PrivateTaskRequestCreationModel, TaskResponseModel, TaskTypeResponseModel, TaskStatusResponseModel } from "../../../domain/entities/task";
import { UserRequestModel } from "../../../domain/entities/user";

export class SQLiteTaskDataSource implements TaskDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_instrument_db()
    }

    init_instrument_db(): void {
        // Create table if not exist and populate them
        this.createTaskStatusTable()
        this.createTaskTypeTable()
        this.createTaskTable()
    }

    createTaskStatusTable(): void {
        // SQL statement to create the task_status table if it does not exist
        const sql_create = `
        CREATE TABLE IF NOT EXISTS 'task_status' (
            task_status_id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_status_label TEXT NOT NULL
        );
        `;
        // Run the SQL query to create the table
        const db_tables = this.db
        db_tables.run(sql_create, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            }
            else {

                // Insert default task_status
                const sql_admin = "INSERT OR IGNORE INTO task_status (task_status_label) VALUES ('PENDING', 'VALIDATING', 'RUNNING', 'WAITING_FO_RESPONSE', 'DONE', 'ERROR');";

                db_tables.run(sql_admin, [], function (err: Error | null) {
                    if (err) {
                        console.log("DB error--", err);
                    }
                });
            }
        });
    }
    createTaskTypeTable(): void {
        // SQL statement to create the task_type table if it does not exist
        const sql_create = `
        CREATE TABLE IF NOT EXISTS 'task_type' (   
            task_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type_label TEXT NOT NULL
        );
        `;

        // Run the SQL query to create the table
        const db_tables = this.db
        db_tables.run(sql_create, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            }
            else {

                // Insert default task_type
                const sql_admin = "INSERT OR IGNORE INTO task_type (task_type_label) VALUES ('EXPORT', 'DELETE', 'UPDATE', 'IMPORT', 'IMPORT_CTD', 'IMPORT_ECO_TAXA');";

                db_tables.run(sql_admin, [], function (err: Error | null) {
                    if (err) {
                        console.log("DB error--", err);
                    }
                });
            }
        });
    }
    createTaskTable(): void {
        // SQL statement to create the task table if it does not exist
        const sql_create_task = `
        CREATE TABLE IF NOT EXISTS 'task' (
            task_id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type_id INTEGER NOT NULL,
            task_status_id INTEGER NOT NULL DEFAULT PENDING,
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
            FOREIGN KEY (task_owner_id) REFERENCES user(task_owner_id) ON DELETE CASCADE,
            FOREIGN KEY (task_project_id) REFERENCES project(task_project_id) ON DELETE CASCADE
        );`

        // Run the SQL query to create the table
        this.db.run(sql_create_task, [], (err: Error | null) => {
            if (err) {
                console.error("Error creating the 'task' table:", err.message);
                return; // Return early if there's an error creating the table
            }
        });
    }

    async create(task: PrivateTaskRequestCreationModel): Promise<number> {
        const params = [task.task_type_id, task.task_status_id, task.task_owner_id, task.task_project_id, task.task_log_file_path, task.task_params];
        const placeholders = params.map(() => '(?)').join(',');
        const sql = `INSERT INTO task (task_type_id, task_status_id, task_owner_id, task_project_id, task_log_file_path, task_params) VALUES (` + placeholders + `);`;

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

    async deleteOne(task: PrivateTaskRequestModel): Promise<number> {
        // delete task based on task_id
        const sql = `DELETE FROM task WHERE task_id = (?)`;
        return await new Promise((resolve, reject) => {
            this.db.run(sql, [task.task_id], function (err) {
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

    async deleteAll(task: PrivateTaskRequestModel): Promise<number> {
        const params: any[] = []
        // delete task based on task_id
        let sql = `DELETE FROM task WHERE `;
        if (task.task_owner_id) {
            sql += `task_owner_id = (?) AND `;
            params.push(task.task_owner_id)
        }
        if (task.task_project_id) {
            sql += `task_project_id = (?) AND `;
            params.push(task.task_project_id)
        }
        if (task.task_id) {
            sql += `task_id = (?) AND `;
            params.push(task.task_id)
        }
        // remove last AND
        sql = sql.slice(0, -4);
        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
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

    async getAll(options: PreparedSearchOptions): Promise<SearchResult<TaskResponseModel>> {
        // options folllow be PrivateTaskRequestModel

        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT task.*, user.first_name, user.last_name, user.email, task_type.task_type_label, task_status.task_status_label, (SELECT COUNT(*) FROM task`
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
                        filtering_sql += "task." + filter.field + ` IN (` + filter.value.map(() => '(?)').join(',') + `) `
                        params_filtering.push(...filter.value)
                    }
                }
                // If value is true or false, set to 1 or 0
                else if (filter.value == true || filter.value == "true") {
                    filtering_sql += "task." + filter.field + ` = 1`;
                }
                else if (filter.value == false || filter.value == "false") {
                    filtering_sql += "task." + filter.field + ` = 0`;
                }
                // If value is undefined, null or empty, and operator =, set to is null
                else if (filter.value == "null") {
                    if (filter.operator == "=") {
                        filtering_sql += "task." + filter.field + ` IS NULL`;
                    } else if (filter.operator == "!=") {
                        filtering_sql += "task." + filter.field + ` IS NOT NULL`;
                    }
                }

                else {
                    filtering_sql += "task." + filter.field + ` ` + filter.operator + ` (?)`
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

        sql += `) AS total_count FROM task LEFT JOIN user ON task.task_owner_id = user.user_id LEFT JOIN task_type ON task.task_type_id = task_type.task_type_id LEFT JOIN task_status ON task.task_status_id = task_status.task_status_id`

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
                    console.log("DB error--", err)
                    reject(err);
                } else {
                    if (rows === undefined) resolve({ items: [], total: 0 });
                    const result: SearchResult<TaskResponseModel> = {
                        items: rows.map(row => ({
                            task_type_id: row.task_type_id,
                            task_type: row.task_type_label,
                            task_status_id: row.task_status_id,
                            task_status: row.task_status_label,
                            task_owner_id: row.task_owner_id,
                            task_owner: row.user_first_name + " " + row.user_last_name + " (" + row.email + ")", // Doe John (john.doe@mail.com)
                            task_project_id: row.task_project_id,
                            task_file_path: row.task_log_file_path,
                            task_progress_pct: row.task_progress_pct,
                            task_progress_msg: row.task_progress_msg,
                            task_params: row.task_params,
                            task_result: row.task_result,
                            task_error: row.task_error,
                            task_question: row.task_question,
                            task_reply: row.task_reply,
                            task_step: row.task_step,
                            task_id: row.task_id,
                            task_creation_date: row.task_creation_date,
                            task_start_date: row.task_start_date,
                            task_end_date: row.task_end_date,
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }
    async getTasksByUser(user: UserRequestModel): Promise<number[]> {
        const sql = `SELECT task_id FROM task WHERE task_owner_id = (?)`;
        return await new Promise((resolve, reject) => {
            this.db.all(sql, [user.user_id], (err, rows) => {
                if (err) {
                    console.log("DB error--", err)
                    reject(err);
                } else {
                    if (rows === undefined) resolve([]);
                    const result = rows.map(row => row.task_id);
                    resolve(result);
                }
            });
        })
    }

    async getOne(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null> {
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(task)) {
            params.push(value)
            placeholders = placeholders + key + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);
        // form final sql
        const sql = `SELECT task.*, user.first_name, user.last_name, user.email, task_type.task_type_label, task_status.task_status_label FROM task LEFT JOIN user ON task.task_owner_id = user.user_id LEFT JOIN task_type ON task.task_type_id = task_type.task_type_id LEFT JOIN task_status ON task.task_status_id = task_status.task_status_id  WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) resolve(null);
                    else {
                        const result = {
                            task_type_id: row.task_type_id,
                            task_type: row.task_type_label,
                            task_status_id: row.task_status_id,
                            task_status: row.task_status_label,
                            task_owner_id: row.task_owner_id,
                            task_owner: row.user_first_name + " " + row.user_last_name + " (" + row.email + ")", // Doe John (john.doe@mail.com)
                            task_project_id: row.task_project_id,
                            task_file_path: row.task_log_file_path,
                            task_progress_pct: row.task_progress_pct,
                            task_progress_msg: row.task_progress_msg,
                            task_params: row.task_params,
                            task_result: row.task_result,
                            task_error: row.task_error,
                            task_question: row.task_question,
                            task_reply: row.task_reply,
                            task_step: row.task_step,
                            task_id: row.task_id,
                            task_creation_date: row.task_creation_date,
                            task_start_date: row.task_start_date,
                            task_end_date: row.task_end_date,
                        };
                        resolve(result);
                    }
                }
            });
        })
    }
    async getAllType(options: PreparedSearchOptions): Promise<SearchResult<TaskTypeResponseModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT *, (SELECT COUNT(*) FROM task_type`
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
                else if (filter.value == "null") {
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

        sql += `) AS total_count FROM task_type`

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
                    const result: SearchResult<TaskTypeResponseModel> = {
                        items: rows.map(row => ({
                            task_type_id: row.task_type_id,
                            task_type_label: row.task_type_label,
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }
    async getAllStatus(options: PreparedSearchOptions): Promise<SearchResult<TaskStatusResponseModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT *, (SELECT COUNT(*) FROM task_status`
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
                else if (filter.value == "null") {
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

        sql += `) AS total_count FROM task_status`

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
                    const result: SearchResult<TaskStatusResponseModel> = {
                        items: rows.map(row => ({
                            task_status_id: row.task_status_id,
                            task_status_label: row.task_status_label,
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }
}

