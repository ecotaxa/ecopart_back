import { UserRequestCreationModel, UserRequestModel, UserResponseModel, UserUpdateModel } from "../../../domain/entities/user";
import { AuthUserCredentialsModel, } from "../../../domain/entities/auth";
import { UserDataSource } from "../../interfaces/data-sources/user-data-source";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// const DB_TABLE = "user"
export class SQLiteUserDataSource implements UserDataSource {

    private db: SQLiteDatabaseWrapper

    constructor(db: SQLiteDatabaseWrapper, GENERIC_ECOTAXA_ACCOUNT_EMAIL: string) {
        this.db = db
        this.init_user_db(GENERIC_ECOTAXA_ACCOUNT_EMAIL)
    }

    init_user_db(GENERIC_ECOTAXA_ACCOUNT_EMAIL: string) {
        // Create table if not exist
        const sql_create = "CREATE TABLE IF NOT EXISTS 'user' (user_id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash CHAR(60) NOT NULL, valid_email BOOLEAN CHECK (valid_email IN (0, 1)) DEFAULT 0, confirmation_code TEXT , reset_password_code TEXT ,is_admin BOOLEAN CHECK (is_admin IN (0, 1)) DEFAULT 0, organisation TEXT NOT NULL, country TEXT NOT NULL, user_planned_usage TEXT NOT NULL, user_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted TIMESTAMP DEFAULT NULL);"
        const db_tables = this.db
        db_tables.run(sql_create, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            }
            else {
                // Create admin user if not exist
                const sql_admin = "INSERT OR IGNORE INTO user (first_name, last_name, email, password_hash, valid_email, is_admin, organisation, country, user_planned_usage) VALUES ('admin', 'admin', 'julie.coustenoble@imev-mer.fr', '$2b$12$5jAAgUpv8hE3LmWGtL7tdeDNnJbQzYo8Bqa.tFiT9YFCyl.GsiJLm', 1, 1, 'admin', 'admin', 'admin');"
                const sql_ecopartApp = "INSERT OR IGNORE INTO user (first_name, last_name, email, password_hash, valid_email, is_admin, organisation, country, user_planned_usage) VALUES ('EcoPart', 'app', '" + GENERIC_ECOTAXA_ACCOUNT_EMAIL + "', '$2b$12$5jAAgUpv8hE3LmWGtL7tdeDNnJbQzYo8Bqa.tFiT9YFCyl.GsiJLm', 1, 0, 'ecopart', 'France', 'Link with ecotaxa');"

                db_tables.run(sql_admin, [], function (err: Error | null) {
                    if (err) {
                        console.log("DB error--", err);
                    } else {
                        db_tables.run(sql_ecopartApp, [], function (err: Error | null) {
                            if (err) {
                                console.log("DB error--", err);
                            }
                        });
                    }
                });
            }
        });
    }

    async create(user: UserRequestCreationModel): Promise<number> {
        const params = [user.first_name, user.last_name, user.email, user.confirmation_code, user.password, user.organisation, user.country, user.user_planned_usage]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO user (first_name, last_name, email, confirmation_code, password_hash, organisation, country, user_planned_usage) VALUES (` + placeholders + `);`;

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

    async getAll(options: PreparedSearchOptions): Promise<SearchResult<UserResponseModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT *, (SELECT COUNT(*) FROM user`
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

        sql += `) AS total_count FROM user`

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
                    const result: SearchResult<UserResponseModel> = {
                        items: rows.map(row => ({
                            user_id: row.user_id,
                            first_name: row.first_name,
                            last_name: row.last_name,
                            email: row.email,
                            valid_email: row.valid_email == 1 ? true : false,
                            is_admin: row.is_admin == 1 ? true : false,
                            organisation: row.organisation,
                            country: row.country,
                            user_planned_usage: row.user_planned_usage,
                            user_creation_date: row.user_creation_date,
                            deleted: row.deleted
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }

    // Returns the number of lines updates
    updateOne(user: UserUpdateModel): Promise<number> {
        const { user_id, ...userData } = user; // Destructure the user object

        const params: any[] = []
        let placeholders: string = ""
        for (const [key, value] of Object.entries(userData)) {
            if (key == "is_admin" || key == "valid_email") { // TODO somewhere else?
                params.push(value == true || value == "true" ? 1 : 0) // TODO clean
            } else {
                params.push(value)
            }
            placeholders = placeholders + key + "=(?),"
        }
        placeholders = placeholders.slice(0, -1);
        params.push(user_id)

        const sql = `UPDATE user SET ` + placeholders + ` WHERE user_id=(?);`;
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

    async getOne(user: UserRequestModel): Promise<UserResponseModel | null> {
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(user)) {
            params.push(value)
            placeholders = placeholders + key + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);
        // form final sql
        const sql = `SELECT * FROM user WHERE ` + placeholders + `LIMIT 1;`;
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
                            user_id: row.user_id,
                            first_name: row.first_name,
                            last_name: row.last_name,
                            email: row.email,
                            confirmation_code: row.confirmation_code,
                            reset_password_code: row.reset_password_code,
                            valid_email: row.valid_email == 1 ? true : false,
                            is_admin: row.is_admin == 1 ? true : false,
                            organisation: row.organisation,
                            country: row.country,
                            user_planned_usage: row.user_planned_usage,
                            user_creation_date: row.user_creation_date,
                            deleted: row.deleted
                        };
                        resolve(result);
                    }
                }
            });
        })
    }

    async getUserLogin(email: string): Promise<AuthUserCredentialsModel | null> {
        const sql = "SELECT * FROM user WHERE email = (?) LIMIT 1;"
        const param = [email]
        return await new Promise((resolve, reject) => {
            this.db.get(sql, param, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        const result: AuthUserCredentialsModel = {
                            email: row.email,
                            password: row.password_hash
                        };
                        resolve(result);
                    } else {
                        resolve(null);
                    }
                }
            });
        })


    }

}

