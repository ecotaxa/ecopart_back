import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import { BroadcastMessageDataSource } from "../../interfaces/data-sources/broadcast_message-data-source";
import {
    BroadcastMessagePersistenceModel,
    BroadcastMessageResponseModel,
    MessageLevel,
} from "../../../domain/entities/broadcast_message";

// The single broadcast message always lives on this pinned primary key.
const SINGLETON_ID = 1;

export class SQLiteBroadcastMessageDataSource implements BroadcastMessageDataSource {
    private db: SQLiteDatabaseWrapper;

    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db;
    }

    private toModel(row: any): BroadcastMessageResponseModel {
        return {
            broadcast_message_id: row.broadcast_message_id,
            message: row.message,
            sub_message: row.sub_message ?? null,
            level: row.level as MessageLevel,
            created_by_user_id: row.created_by_user_id ?? null,
            message_creation_utc_date_time: row.message_creation_utc_date_time,
        };
    }

    getMessage(): Promise<BroadcastMessageResponseModel | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM broadcast_message WHERE broadcast_message_id = ?;`,
                [SINGLETON_ID],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? this.toModel(row) : null);
                },
            );
        });
    }

    setMessage(message: BroadcastMessagePersistenceModel): Promise<BroadcastMessageResponseModel> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR REPLACE INTO broadcast_message
                    (broadcast_message_id, message, sub_message, level, created_by_user_id, message_creation_utc_date_time)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                [
                    SINGLETON_ID,
                    message.message,
                    message.sub_message,
                    message.level,
                    message.created_by_user_id,
                    message.message_creation_utc_date_time,
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve({ broadcast_message_id: SINGLETON_ID, ...message });
                },
            );
        });
    }

    deleteMessage(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM broadcast_message WHERE broadcast_message_id = ?;`,
                [SINGLETON_ID],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                },
            );
        });
    }
}
