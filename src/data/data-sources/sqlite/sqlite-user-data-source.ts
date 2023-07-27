import { UserRequestModel, UserResponseModel } from "../../../domain/entities/user";
import { UserDataSource } from "../../interfaces/data-sources/user-data-source";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";

const DB_TABLE = "user"
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
        const sql_create = "CREATE TABLE IF NOT EXISTS 'user' (user_id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash CHAR(60) NOT NULL, status TEXT NOT NULL DEFAULT 'Pending');"
        this.db.run(sql_create, [])
    }


    async create(user: UserRequestModel): Promise<number> {
        console.log("--------- create user -----------")
        const params = [user.firstName, user.lastName, user.email, user.password]
        const placeholders = params.map((param) => '(?)').join(','); // TODO create tool funct
        console.log(params)
        const sql = `INSERT INTO user (first_name, last_name, email, password_hash) VALUES (` + placeholders + `)`;

        console.log(sql)

        return await new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    console.log(err)
                    reject(err);
                } else {
                    const result = this.lastID;
                    console.log(result)
                    resolve(result);
                }
            });
        })
    }
    async getAll(): Promise<UserResponseModel[]> {
        console.log("--------- getAll users -----------")
        const sql = "SELECT * from user"
        return await new Promise((resolve, reject) => {
            this.db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const result = rows.map(item => ({
                        id: item.user_id,
                        firstName: item.first_name,
                        lastName: item.last_name,
                        email: item.email,
                        status: item.status
                    }));
                    resolve(result);
                }
            });
        })
    }



    // async deleteOne(id: String) {
    //     await this.db.run(`delete ${DB_TABLE} where id = $1`, [id])
    // }

    // async updateOne(id: String, data: UserRequestModel) {
    //     await this.db.run(`update ${DB_TABLE} set name = $1 where id = $2`, [data.name, id])
    // }

    async getOne(id: number): Promise<UserResponseModel | null> {
        console.log("--------- getOne users -----------")

        const sql = "SELECT * FROM user WHERE user_id = (?) LIMIT 1" // TODO db_table

        return await new Promise((resolve, reject) => {
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const result = {
                        id: row.user_id,
                        firstName: row.first_name,
                        lastName: row.last_name,
                        email: row.email,
                        status: row.status
                    };
                    resolve(result);
                }
            });
        })
    }
}

