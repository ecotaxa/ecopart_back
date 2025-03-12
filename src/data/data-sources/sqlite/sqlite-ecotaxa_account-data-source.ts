import { EcotaxaAccountRequestCreationModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel, EcotaxaInstanceModel } from "../../../domain/entities/ecotaxa_account";
import { EcotaxaAccountDataSource } from "../../interfaces/data-sources/ecotaxa_account-data-source";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// const DB_TABLE = "ecotaxa_account"
export class SQLiteEcotaxaAccountDataSource implements EcotaxaAccountDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_ecotaxa_account_db()
    }

    init_ecotaxa_account_db() {
        this.createEcotaxaInstanceTable()
        this.createEcotaxaAccountTable()
    }

    createEcotaxaAccountTable(): void {
        // SQL statement to create the ecotaxa_instance table if it does not exist
        const sql_ecotaxa_account = `
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
         `;

        // Run the SQL query to create the table
        const db_tables = this.db;
        db_tables.run(sql_ecotaxa_account, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            }
        });
    }

    createEcotaxaInstanceTable(): void {
        // SQL statement to create the ecotaxa_instance table if it does not exist
        const sql_ecotaxa_instance = `
            CREATE TABLE IF NOT EXISTS ecotaxa_instance (
                ecotaxa_instance_id INTEGER PRIMARY KEY AUTOINCREMENT,
                ecotaxa_instance_name TEXT UNIQUE NOT NULL,
                ecotaxa_instance_description TEXT NOT NULL,
                ecotaxa_instance_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ecotaxa_instance_url TEXT UNIQUE NOT NULL
            );
        `;

        // Run the SQL query to create the table
        const db_tables = this.db;
        db_tables.run(sql_ecotaxa_instance, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            } else {
                // Insert default instance
                const sql_default_instance = `
                    INSERT OR IGNORE INTO ecotaxa_instance (ecotaxa_instance_name, ecotaxa_instance_description, ecotaxa_instance_url)
                    VALUES 
                        ('FR', 'French instance of EcoTaxa, can be used world wilde.', 'https://ecotaxa.obs-vlfr.fr/');
                `;

                db_tables.run(sql_default_instance, [], function (err: Error | null) {
                    if (err) {
                        console.log("DB error--", err);
                    }
                });
            }
        });
    }

    async create(ecotaxa_account: EcotaxaAccountRequestCreationModel): Promise<number> {
        const params = [ecotaxa_account.ecotaxa_account_ecotaxa_id, ecotaxa_account.ecotaxa_account_token, ecotaxa_account.ecotaxa_account_user_name, ecotaxa_account.ecotaxa_account_user_email, ecotaxa_account.ecotaxa_account_expiration_date, ecotaxa_account.ecotaxa_account_ecopart_user_id, ecotaxa_account.ecotaxa_account_instance_id]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO ecotaxa_account (ecotaxa_account_ecotaxa_id, ecotaxa_account_token, ecotaxa_account_user_name, ecotaxa_account_user_email, ecotaxa_account_expiration_date, ecotaxa_account_ecopart_user_id, ecotaxa_account_instance_id) VALUES (` + placeholders + `);`;

        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    const result = this.lastID;
                    resolve(result);
                }
            });
        })
    }

    async getOne(ecotaxa_account_id: number): Promise<EcotaxaAccountResponseModel | null> {
        const sql = "SELECT ecotaxa_instance.ecotaxa_instance_name, ecotaxa_account.* FROM ecotaxa_account INNER JOIN ecotaxa_instance ON ecotaxa_account.ecotaxa_account_instance_id = ecotaxa_instance.ecotaxa_instance_id WHERE ecotaxa_account_id = (?)";
        const params = [ecotaxa_account_id];
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) {
                        resolve(null);
                        return;
                    }
                    const result: EcotaxaAccountResponseModel = {
                        ecotaxa_account_id: row.ecotaxa_account_id,
                        ecotaxa_account_ecotaxa_id: row.ecotaxa_account_ecotaxa_id,
                        ecotaxa_account_creation_date: row.ecotaxa_account_creation_date,
                        ecotaxa_account_ecopart_user_id: row.ecotaxa_account_ecopart_user_id,
                        ecotaxa_account_token: row.ecotaxa_account_token,
                        ecotaxa_account_user_name: row.ecotaxa_account_user_name,
                        ecotaxa_account_user_email: row.ecotaxa_account_user_email,
                        ecotaxa_account_instance_id: row.ecotaxa_account_instance_id,
                        ecotaxa_account_expiration_date: row.ecotaxa_account_expiration_date,
                        ecotaxa_account_instance_name: row.ecotaxa_instance_name
                    };
                    resolve(result);
                }
            });
        })
    }

    async getAll(options: PreparedSearchOptions): Promise<SearchResult<EcotaxaAccountResponseModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT ecotaxa_instance.ecotaxa_instance_name, ecotaxa_account.* , (SELECT COUNT(*) FROM ecotaxa_account`
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

        sql += `) AS total_count FROM ecotaxa_account INNER JOIN ecotaxa_instance ON ecotaxa_account.ecotaxa_account_instance_id = ecotaxa_instance.ecotaxa_instance_id`

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
                    const result: SearchResult<EcotaxaAccountResponseModel> = {
                        items: rows.map(row => ({
                            ecotaxa_account_id: row.ecotaxa_account_id,
                            ecotaxa_account_ecotaxa_id: row.ecotaxa_account_ecotaxa_id,
                            ecotaxa_account_creation_date: row.ecotaxa_account_creation_date,
                            ecotaxa_account_ecopart_user_id: row.ecotaxa_account_ecopart_user_id,
                            ecotaxa_account_token: row.ecotaxa_account_token,
                            ecotaxa_account_user_name: row.ecotaxa_account_user_name,
                            ecotaxa_account_user_email: row.ecotaxa_account_user_email,
                            ecotaxa_account_instance_id: row.ecotaxa_account_instance_id,
                            ecotaxa_account_expiration_date: row.ecotaxa_account_expiration_date,
                            ecotaxa_account_instance_name: row.ecotaxa_instance_name
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }

    async deleteOne(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number> {
        // returns the number of deleted rows
        const sql = "DELETE FROM ecotaxa_account WHERE ecotaxa_account_id = (?) and ecotaxa_account_ecopart_user_id = (?)";
        const params = [ecotaxa_account.ecotaxa_account_id, ecotaxa_account.ecotaxa_account_ecopart_user_id];
        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    const nb_of_deleted_rows = this.changes;
                    resolve(nb_of_deleted_rows);
                }
            });
        })
    }

    async getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null> {
        const sql = "SELECT * FROM ecotaxa_instance WHERE ecotaxa_instance_id = (?)";
        const params = [ecotaxa_instance_id];
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) {
                        resolve(null);
                        return;
                    }
                    const result: EcotaxaInstanceModel = {
                        ecotaxa_instance_id: row.ecotaxa_instance_id,
                        ecotaxa_instance_name: row.ecotaxa_instance_name,
                        ecotaxa_instance_description: row.ecotaxa_instance_description,
                        ecotaxa_instance_creation_date: row.ecotaxa_instance_creation_date,
                        ecotaxa_instance_url: row.ecotaxa_instance_url
                    };
                    resolve(result)
                }
            });
        })
    }
}

