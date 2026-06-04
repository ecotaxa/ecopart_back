import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Project-wide rename of *_date columns to the *_utc_date_time convention.
// Per user decision (replacement of all 8 tables in one shot).

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

async function renameColumn(db: SQLiteDatabaseWrapper, table: string, from: string, to: string): Promise<void> {
    const cols = await tableColumns(db, table);
    if (cols.includes(from) && !cols.includes(to)) {
        await runSQL(db, `ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to};`);
    }
}

const RENAMES: Array<[string, string, string]> = [
    // [table, from, to]
    ["sample", "sampling_date", "sampling_utc_date_time"],
    ["sample", "sample_creation_date", "sample_creation_utc_date_time"],
    ["sample", "ecotaxa_sample_import_date", "ecotaxa_sample_import_utc_date_time"],
    ["sample", "ctd_import_date", "ctd_import_utc_date_time"],
    ["project", "project_creation_date", "project_creation_utc_date_time"],
    ["project", "last_backup_date", "last_backup_utc_date_time"],
    ["task", "task_creation_date", "task_creation_utc_date_time"],
    ["task", "task_start_date", "task_start_utc_date_time"],
    ["task", "task_end_date", "task_end_utc_date_time"],
    ["user", "user_creation_date", "user_creation_utc_date_time"],
    ["privilege", "privilege_creation_date", "privilege_creation_utc_date_time"],
    ["ecotaxa_instance", "ecotaxa_instance_creation_date", "ecotaxa_instance_creation_utc_date_time"],
    ["ecotaxa_account", "ecotaxa_account_creation_date", "ecotaxa_account_creation_utc_date_time"],
    ["ecotaxa_account", "ecotaxa_account_expiration_date", "ecotaxa_account_expiration_utc_date_time"],
    ["instrument_model", "instrument_model_creation_date", "instrument_model_creation_utc_date_time"],
];

export const migration: Migration = {
    id: "017_rename_date_columns_to_utc_date_time",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        for (const [table, from, to] of RENAMES) {
            await renameColumn(db, table, from, to);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        for (const [table, from, to] of RENAMES) {
            await renameColumn(db, table, to, from);
        }
    },
};
