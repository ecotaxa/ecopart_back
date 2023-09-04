import { UserRequesCreationtModel, UserRequestModel, UserResponseModel } from "../../../domain/entities/user";
import { AuthUserCredentialsModel, } from "../../../domain/entities/auth";
import { UserDataSource } from "../../interfaces/data-sources/user-data-source";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";

// const DB_TABLE = "user"
export class SQLiteUserDataSource implements UserDataSource {

    private db: SQLiteDatabaseWrapper
    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
        this.init_user_db()
    }

    init_user_db() {
        // TODO ajouter le table
        // init user table
        // const sql_type = "CREATE TABLE IF NOT EXISTS 'user_status' (user_status_id CHAR1 PRIMARY KEY AUTOINCREMENT, user_status_label TEXT NOT NULL);"
        // this.db.run(sql_type, [])
        // const sql_insert = `INSERT INTO user_status(user_status_label) VALUES('Pending');
        // INSERT INTO user_status(user_status_label) VALUES('Active');
        // INSERT INTO user_status(user_status_label) VALUES('Suspended');`
        //this.db.run(sql_insert, [])
        const sql_create = "CREATE TABLE IF NOT EXISTS 'user' (user_id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash CHAR(60) NOT NULL, status TEXT NOT NULL DEFAULT 'Pending', organisation TEXT NOT NULL, country TEXT NOT NULL, user_planned_usage TEXT NOT NULL, user_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);"
        this.db.run(sql_create, [])
    }


    async create(user: UserRequesCreationtModel): Promise<number> {
        const params = [user.firstName, user.lastName, user.email, user.password, user.organisation, user.country, user.user_planned_usage]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO user (first_name, last_name, email, password_hash, organisation, country, user_planned_usage) VALUES (` + placeholders + `)`;

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
    async getAll(): Promise<UserResponseModel[]> {
        const sql = "SELECT * from user"
        return await new Promise((resolve, reject) => {
            this.db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const result = rows.map(row => ({
                        id: row.user_id,
                        firstName: row.first_name,
                        lastName: row.last_name,
                        email: row.email,
                        status: row.status,
                        organisation: row.organisation,
                        country: row.country,
                        user_planned_usage: row.user_planned_usage,
                        user_creation_date: row.user_creation_date,
                    }));
                    resolve(result);
                }
            });
        })
    }

    // async deleteOne(id: String) {
    //     await this.db.run(`delete ${DB_TABLE} where id = $1`, [id])
    // }

    // async updateOne(id: String, data: UserRequesCreationtModel) {
    //     await this.db.run(`update ${DB_TABLE} set name = $1 where id = $2`, [data.name, id])
    // }

    async getOne(user: UserRequestModel): Promise<UserResponseModel | null> {
        let sql: string = ""
        let param: any[] = []
        if (user.id !== undefined) {
            sql = "SELECT * FROM user WHERE user_id = (?) LIMIT 1" // TODO db_table
            param = [user.id]
        } else if (user.email !== undefined) {
            sql = "SELECT * FROM user WHERE email = (?) LIMIT 1" // TODO db_table
            param = [user.email]
        }
        return await new Promise((resolve, reject) => {
            this.db.get(sql, param, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const result = {
                        id: row.user_id,
                        firstName: row.first_name,
                        lastName: row.last_name,
                        email: row.email,
                        status: row.status,
                        organisation: row.organisation,
                        country: row.country,
                        user_planned_usage: row.user_planned_usage,
                        user_creation_date: row.user_creation_date,
                    };
                    resolve(result);
                }
            });
        })


    }
    async getUserLogin(email: string): Promise<AuthUserCredentialsModel | null> {
        const sql = "SELECT * FROM user WHERE email = (?) LIMIT 1"
        const param = [email]
        return await new Promise((resolve, reject) => {
            this.db.get(sql, param, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const result = {
                        email: row.email,
                        password: row.password_hash
                    };
                    resolve(result);
                }
            });
        })


    }

}

