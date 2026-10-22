import { UserSessionModel } from "../../../domain/entities/auth";
import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { UserSessionDataSource } from "../../interfaces/data-sources/user-session-data-source";

export class SQLiteUserSessionDataSource implements UserSessionDataSource {
    private db: SQLiteDatabaseWrapper

    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db
    }

    private run(sql: string, params: unknown[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        })
    }

    async create(session: UserSessionModel): Promise<void> {
        await this.run(
            "INSERT INTO user_session (session_id, user_id, session_creation_utc_date_time, session_expiration_utc_date_time, session_revocation_utc_date_time) VALUES (?, ?, ?, ?, ?)",
            [session.session_id, session.user_id, session.session_creation_utc_date_time, session.session_expiration_utc_date_time, session.session_revocation_utc_date_time]
        );
    }

    async getOne(session_id: string): Promise<UserSessionModel | null> {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT * FROM user_session WHERE session_id = (?)", [session_id], (err, row) => {
                if (err) return reject(err);
                if (row === undefined) return resolve(null);
                resolve({
                    session_id: row.session_id,
                    user_id: row.user_id,
                    session_creation_utc_date_time: row.session_creation_utc_date_time,
                    session_expiration_utc_date_time: row.session_expiration_utc_date_time,
                    session_revocation_utc_date_time: row.session_revocation_utc_date_time,
                });
            });
        })
    }

    async updateExpiration(session_id: string, expiration_utc_date_time: string): Promise<number> {
        return this.run("UPDATE user_session SET session_expiration_utc_date_time = (?) WHERE session_id = (?) AND session_revocation_utc_date_time IS NULL", [expiration_utc_date_time, session_id]);
    }

    async revoke(session_id: string, revocation_utc_date_time: string): Promise<number> {
        return this.run("UPDATE user_session SET session_revocation_utc_date_time = (?) WHERE session_id = (?) AND session_revocation_utc_date_time IS NULL", [revocation_utc_date_time, session_id]);
    }

    async revokeAllOfUser(user_id: number, revocation_utc_date_time: string, except_session_id?: string): Promise<number> {
        if (except_session_id) {
            return this.run("UPDATE user_session SET session_revocation_utc_date_time = (?) WHERE user_id = (?) AND session_id != (?) AND session_revocation_utc_date_time IS NULL", [revocation_utc_date_time, user_id, except_session_id]);
        }
        return this.run("UPDATE user_session SET session_revocation_utc_date_time = (?) WHERE user_id = (?) AND session_revocation_utc_date_time IS NULL", [revocation_utc_date_time, user_id]);
    }

    async deleteEndedBefore(utc_date_time: string): Promise<number> {
        return this.run("DELETE FROM user_session WHERE session_expiration_utc_date_time < (?) OR session_revocation_utc_date_time < (?)", [utc_date_time, utc_date_time]);
    }
}
