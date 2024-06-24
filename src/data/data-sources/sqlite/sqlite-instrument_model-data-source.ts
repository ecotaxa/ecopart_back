import { InstrumentModelRequestCreationModel, InstrumentModelRequestModel, InstrumentModelResponseModel, InstrumentModelUpdateModel } from "../../../domain/entities/instrument_model";
import { InstrumentModelDataSource } from "../../interfaces/data-sources/instrument_model-data-source";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

// const DB_TABLE = "instrument"
export class SQLiteInstrumentModelDataSource implements InstrumentModelDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_instrument_db()
    }

    init_instrument_db() {
        // Create table if not exist
        const sql_create = "CREATE TABLE IF NOT EXISTS 'instrument_model' (instrument_model_id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_model_name TEXT NOT NULL UNIQUE, bodc_url TEXT NOT NULL, instrument_model_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);"
        const db_tables = this.db
        db_tables.run(sql_create, [], function (err: Error | null) {
            if (err) {
                console.log("DB error--", err);
                return; // Return early if there's an error creating the table
            }
            else {

                const sql_admin = "INSERT OR IGNORE INTO instrument_model (instrument_model_name, bodc_url) VALUES ('UVP5HD', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/'), ('UVP5SD', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/'), ('UVP5Z', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/'), ('UVP6LP', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/'), ('UVP6HF', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/'), ('UVP6MHP','Not registred in BODC for now'), ('UVP6MHF', 'Not registred in BODC for now');"

                db_tables.run(sql_admin, [], function (err: Error | null) {
                    if (err) {
                        console.log("DB error--", err);
                    }
                });
            }
        });
    }

    async create(instrument_model: InstrumentModelRequestCreationModel): Promise<number> {
        const params = [instrument_model.instrument_model_name, instrument_model.bodc_url];
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO instrument_model (instrument_model, bodc_url) VALUES (` + placeholders + `);`;

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

    async getAll(options: PreparedSearchOptions): Promise<SearchResult<InstrumentModelResponseModel>> {
        // Get the limited rows and the total count of rows //  WHERE your_condition
        let sql = `SELECT *, (SELECT COUNT(*) FROM instrument_model`
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

        sql += `) AS total_count FROM instrument_model`

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
                    const result: SearchResult<InstrumentModelResponseModel> = {
                        items: rows.map(row => ({
                            instrument_model_id: row.instrument_model_id,
                            instrument_model_name: row.instrument_model_name,
                            bodc_url: row.bodc_url,
                            instrument_model_creation_date: row.instrument_model_creation_date
                        })),
                        total: rows[0]?.total_count || 0
                    };
                    resolve(result);
                }
            });
        })
    }

    // Returns the number of lines updates
    updateOne(instrument: InstrumentModelUpdateModel): Promise<number> {
        const { instrument_model_id, ...instrumentData } = instrument; // Destructure the instrument object

        const params: any[] = []
        let placeholders: string = ""
        for (const [key, value] of Object.entries(instrumentData)) {

            params.push(value)

            placeholders = placeholders + key + "=(?),"
        }
        placeholders = placeholders.slice(0, -1);
        params.push(instrument_model_id)

        const sql = `UPDATE instrument_model SET ` + placeholders + ` WHERE instrument_model_id=(?);`;
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

    async getOne(instrument_model: InstrumentModelRequestModel): Promise<InstrumentModelResponseModel | null> {
        const params: any[] = []
        let placeholders: string = ""
        // generate sql and params
        for (const [key, value] of Object.entries(instrument_model)) {
            params.push(value)
            placeholders = placeholders + key + "=(?) AND "
        }
        // remove last AND
        placeholders = placeholders.slice(0, -4);
        // form final sql
        const sql = `SELECT * FROM instrument_model WHERE ` + placeholders + `;`;
        return await new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) resolve(null);
                    else {
                        const result = {
                            instrument_model_id: row.instrument_model_id,
                            instrument_model_name: row.instrument_model_name,
                            bodc_url: row.bodc_url,
                            instrument_model_creation_date: row.instrument_model_creation_date
                        };
                        resolve(result);
                    }
                }
            });
        })
    }
}

