// import { PrivilegeRequestCreationModel, PrivilegeRequestModel, PrivilegeResponseModel, PrivilegeUpdateModel } from "../../../domain/entities/privilege";
import { PrivilegeDataSource } from "../../interfaces/data-sources/privilege-data-source";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
import { PrivilegeRequestCreationModel, PrivilegeRequestModel, PrivilegeResponseModel } from "../../../domain/entities/privilege";
// import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// const DB_TABLE = "instrument"
export class SQLitePrivilegeDataSource implements PrivilegeDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_instrument_db()
    }

    init_instrument_db(): void {
        // SQL statement to create the privilege table if it does not exist
        const sql_create = `
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
        `;

        // Run the SQL query to create the table
        this.db.run(sql_create, [], (err: Error | null) => {
            if (err) {
                console.error("Error creating the 'privilege' table:", err.message);
                return; // Return early if there's an error creating the table
            }
        });
    }

    async create(privilege: PrivilegeRequestCreationModel): Promise<number> {
        const params = [privilege.privilege_name, privilege.user_id, privilege.project_id, privilege.contact];
        const placeholders = params.map(() => '(?)').join(',');
        const sql = `INSERT INTO privilege (privilege_name, user_id, project_id, contact) VALUES (` + placeholders + `);`;

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

    async deleteOne(privilege: PrivilegeRequestModel): Promise<number> {
        // delete privilege based on privilege_id
        const sql = `DELETE FROM privilege WHERE privilege_id = (?)`;
        return await new Promise((resolve, reject) => {
            this.db.run(sql, [privilege.privilege_id], function (err) {
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

    async deleteAll(privilege: PrivilegeRequestModel): Promise<number> {
        const params: any[] = []
        // delete privilege based on privilege_id
        let sql = `DELETE FROM privilege WHERE `;
        if (privilege.user_id) {
            sql += `user_id = (?) AND `;
            params.push(privilege.user_id)
        }
        if (privilege.project_id) {
            sql += `project_id = (?) AND `;
            params.push(privilege.project_id)
        }
        if (privilege.privilege_id) {
            sql += `privilege_id = (?) AND `;
            params.push(privilege.privilege_id)
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

    async getAll(options: PreparedSearchOptions): Promise<SearchResult<PrivilegeResponseModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT privilege.*, user.first_name, user.last_name, user.email, (SELECT COUNT(*) FROM privilege`
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
                        filtering_sql += "privilege." + filter.field + ` IN (` + filter.value.map(() => '(?)').join(',') + `) `
                        params_filtering.push(...filter.value)
                    }
                }
                // If value is true or false, set to 1 or 0
                else if (filter.value == true || filter.value == "true") {
                    filtering_sql += "privilege." + filter.field + ` = 1`;
                }
                else if (filter.value == false || filter.value == "false") {
                    filtering_sql += "privilege." + filter.field + ` = 0`;
                }
                // If value is undefined, null or empty, and operator =, set to is null
                else if (filter.value == undefined || filter.value == null || filter.value == "") {
                    if (filter.operator == "=") {
                        filtering_sql += "privilege." + filter.field + ` IS NULL`;
                    } else if (filter.operator == "!=") {
                        filtering_sql += "privilege." + filter.field + ` IS NOT NULL`;
                    }
                }

                else {
                    filtering_sql += "privilege." + filter.field + ` ` + filter.operator + ` (?)`
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

        sql += `) AS total_count FROM privilege LEFT JOIN user ON privilege.user_id = user.user_id`

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
                    const result: SearchResult<PrivilegeResponseModel> = {
                        items: rows.map(row => ({
                            privilege_id: row.privilege_id,
                            user_id: row.user_id,
                            user_name: row.user_first_name + " " + row.user_last_name,
                            email: row.email,
                            project_id: row.project_id,
                            privilege_name: row.privilege_name,
                            contact: row.contact == 1 ? true : false,
                            privilege_creation_date: row.privilege_creation_date
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }

    async getOne(privilege: PrivilegeRequestModel): Promise<PrivilegeResponseModel | null> {
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(privilege)) {
            params.push(value)
            placeholders = placeholders + key + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);
        // form final sql
        const sql = `SELECT privilege.*, user.first_name, user.last_name, user.email, FROM privilege LEFT JOIN user ON privilege.user_id = user.user_id WHERE ` + placeholders + `LIMIT 1;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) resolve(null);
                    else {
                        const result = {
                            privilege_id: row.privilege_id,
                            user_id: row.user_id,
                            user_name: row.user_first_name + " " + row.user_last_name,
                            email: row.email,
                            project_id: row.project_id,
                            privilege_name: row.privilege_name,
                            contact: row.contact == 1 ? true : false,
                            privilege_creation_date: row.privilege_creation_date
                        };
                        resolve(result);
                    }
                }
            });
        })
    }
}

