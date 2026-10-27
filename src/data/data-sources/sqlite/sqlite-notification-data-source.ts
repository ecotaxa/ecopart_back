import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { NotificationDataSource } from "../../interfaces/data-sources/notification-data-source";
import { NotificationRequestCreationModel, NotificationResponseModel, NotificationSearchModel, NotificationType } from "../../../domain/entities/notification";
import { SearchResult } from "../../../domain/entities/search";

export class SQLiteNotificationDataSource implements NotificationDataSource {
    private db: SQLiteDatabaseWrapper;

    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db;
    }

    private toModel(row: any): NotificationResponseModel {
        return {
            notification_id: row.notification_id,
            user_id: row.user_id,
            notification_type: row.notification_type as NotificationType,
            notification_message: row.notification_message,
            task_id: row.task_id ?? null,
            project_id: row.project_id ?? null,
            is_read: row.is_read === 1,
            notification_creation_utc_date_time: row.notification_creation_utc_date_time,
        };
    }

    private run(sql: string, params: unknown[]): Promise<{ lastID: number, changes: number }> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    private all(sql: string, params: unknown[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });
    }

    async create(notification: NotificationRequestCreationModel & { notification_creation_utc_date_time: string }): Promise<number> {
        const result = await this.run(
            `INSERT INTO notification (user_id, notification_type, notification_message, task_id, project_id, notification_creation_utc_date_time)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [
                notification.user_id,
                notification.notification_type,
                notification.notification_message,
                notification.task_id ?? null,
                notification.project_id ?? null,
                notification.notification_creation_utc_date_time,
            ],
        );
        return result.lastID;
    }

    async getOne(notification_id: number): Promise<NotificationResponseModel | null> {
        const rows = await this.all(`SELECT * FROM notification WHERE notification_id = ?;`, [notification_id]);
        return rows.length > 0 ? this.toModel(rows[0]) : null;
    }

    async getAll(search: NotificationSearchModel): Promise<SearchResult<NotificationResponseModel>> {
        const where = `WHERE user_id = ?` + (search.unread_only ? ` AND is_read = 0` : ``);
        const [{ total }] = await this.all(`SELECT COUNT(*) AS total FROM notification ${where};`, [search.user_id]);
        const rows = await this.all(
            `SELECT * FROM notification ${where} ORDER BY notification_id DESC LIMIT ? OFFSET ?;`,
            [search.user_id, search.limit, (search.page - 1) * search.limit],
        );
        return { items: rows.map(row => this.toModel(row)), total };
    }

    async countUnread(user_id: number): Promise<number> {
        const [{ total }] = await this.all(`SELECT COUNT(*) AS total FROM notification WHERE user_id = ? AND is_read = 0;`, [user_id]);
        return total;
    }

    async markRead(user_id: number, notification_id?: number): Promise<number> {
        const by_id = notification_id !== undefined;
        const result = await this.run(
            `UPDATE notification SET is_read = 1 WHERE user_id = ? AND is_read = 0` + (by_id ? ` AND notification_id = ?` : ``) + `;`,
            by_id ? [user_id, notification_id] : [user_id],
        );
        return result.changes;
    }

    async deleteOne(user_id: number, notification_id: number): Promise<number> {
        const result = await this.run(`DELETE FROM notification WHERE user_id = ? AND notification_id = ?;`, [user_id, notification_id]);
        return result.changes;
    }
}
