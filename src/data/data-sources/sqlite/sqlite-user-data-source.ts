import { UserRequesCreationtModel, UserRequestModel, UserResponseModel, UserUpdateModel } from "../../../domain/entities/user";
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
        const sql_create = "CREATE TABLE IF NOT EXISTS 'user' (user_id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash CHAR(60) NOT NULL, valid_email BOOLEAN CHECK (valid_email IN (0, 1)) DEFAULT 0, confirmation_code TEXT ,is_admin BOOLEAN CHECK (is_admin IN (0, 1)) DEFAULT 0, organisation TEXT NOT NULL, country TEXT NOT NULL, user_planned_usage TEXT NOT NULL, user_creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);"
        this.db.run(sql_create, [])
    }

    async create(user: UserRequesCreationtModel): Promise<number> {
        const params = [user.first_name, user.last_name, user.email, user.confirmation_code, user.password, user.organisation, user.country, user.user_planned_usage]
        const placeholders = params.map(() => '(?)').join(','); // TODO create tool funct
        const sql = `INSERT INTO user (first_name, last_name, email, confirmation_code, password_hash, organisation, country, user_planned_usage) VALUES (` + placeholders + `)`;

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
                        first_name: row.first_name,
                        last_name: row.last_name,
                        email: row.email,
                        valid_email: row.valid_email == 1 ? true : false,
                        is_admin: row.is_admin == 1 ? true : false,
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
    //TODO 
    // async deleteOne(id: String) {
    //     await this.db.run(`delete ${DB_TABLE} where id = $1`, [id])
    // }
    deleteOne(id: string): void {
        console.log(id)
        throw new Error("Method not implemented.");
    }

    // Returns the number of lines updates
    updateOne(user: UserUpdateModel): Promise<number> {
        const { id, ...userData } = user; // Destructure the user object

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
        params.push(id)

        const sql = `UPDATE user SET ` + placeholders + ` WHERE user_id=(?) RETURNING *;`;

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
        let sql: string = ""
        let param: any[] = []
        if (user.id !== undefined) {
            sql = "SELECT * FROM user WHERE user_id = (?) LIMIT 1"
            param = [user.id]
        } else if (user.email !== undefined) {
            sql = "SELECT * FROM user WHERE email = (?) LIMIT 1"
            param = [user.email]
        } else if (user.confirmation_code !== undefined) {
            sql = "SELECT * FROM user WHERE confirmation_code = (?) LIMIT 1"
            param = [user.confirmation_code]
        }
        return await new Promise((resolve, reject) => {
            this.db.get(sql, param, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row === undefined) resolve(null);
                    else {
                        const result = {
                            id: row.user_id,
                            first_name: row.first_name,
                            last_name: row.last_name,
                            email: row.email,
                            confirmation_code: row.confirmation_code,
                            valid_email: row.valid_email == 1 ? true : false,
                            is_admin: row.is_admin == 1 ? true : false,
                            organisation: row.organisation,
                            country: row.country,
                            user_planned_usage: row.user_planned_usage,
                            user_creation_date: row.user_creation_date,
                        };
                        resolve(result);
                    }
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

