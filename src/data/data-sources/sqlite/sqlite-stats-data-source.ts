import { SQLiteDatabaseWrapper } from "../../interfaces/data-sources/database-wrapper";
import {
    ProjectSizingRow,
    StatsCreationSeriesRow,
    StatsDataSource,
    StatsPeriodScalarsDbPart,
    StatsTotalsDbPart,
} from "../../interfaces/data-sources/stats-data-source";
import { LabelCount, OrganisationCount } from "../../../domain/entities/stats";

// Coerce a SQLite scalar (COUNT is a number, SUM(...) can be null over 0 rows) to a safe number.
function n(value: any): number {
    return Number(value) || 0;
}

export class SQLiteStatsDataSource implements StatsDataSource {

    private db: SQLiteDatabaseWrapper;

    constructor(db: SQLiteDatabaseWrapper) {
        this.db = db;
    }

    private queryOne<T = any>(sql: string, params: any[]): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err); else resolve(row as T);
            });
        });
    }

    private queryAll<T = any>(sql: string, params: any[]): Promise<T[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err); else resolve((rows ?? []) as T[]);
            });
        });
    }

    private toLabelCounts(rows: any[]): LabelCount[] {
        return rows.map(r => ({ label: r.label, count: n(r.cnt) }));
    }

    async getTotals(): Promise<StatsTotalsDbPart> {
        const usersRow = await this.queryOne(
            `SELECT
                SUM(CASE WHEN deleted IS NULL THEN 1 ELSE 0 END) AS total,
                SUM(CASE WHEN deleted IS NULL AND is_admin = 1 THEN 1 ELSE 0 END) AS admins,
                SUM(CASE WHEN deleted IS NULL AND valid_email = 1 THEN 1 ELSE 0 END) AS validated_email,
                SUM(CASE WHEN deleted IS NULL AND valid_email = 0 THEN 1 ELSE 0 END) AS pending_validation,
                SUM(CASE WHEN deleted IS NOT NULL THEN 1 ELSE 0 END) AS deleted,
                COUNT(DISTINCT CASE WHEN deleted IS NULL THEN organisation END) AS distinct_organisations
             FROM user;`, []);

        const projectsRow = await this.queryOne(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN last_backup_utc_date_time IS NOT NULL THEN 1 ELSE 0 END) AS backed_up,
                SUM(CASE WHEN ecotaxa_project_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_to_ecotaxa
             FROM project;`, []);

        const byInstrument = await this.queryAll(
            `SELECT COALESCE(im.instrument_model_name, 'UNKNOWN') AS label, COUNT(*) AS cnt
             FROM project p
             LEFT JOIN instrument_model im ON p.instrument_model = im.instrument_model_id
             GROUP BY label ORDER BY cnt DESC;`, []);

        const tasksByType = await this.queryAll(
            `SELECT tt.task_type_label AS label, COUNT(*) AS cnt
             FROM task t JOIN task_type tt ON t.task_type_id = tt.task_type_id
             GROUP BY label ORDER BY cnt DESC;`, []);

        const tasksByStatus = await this.queryAll(
            `SELECT ts.task_status_label AS label, COUNT(*) AS cnt
             FROM task t JOIN task_status ts ON t.task_status_id = ts.task_status_id
             GROUP BY label ORDER BY cnt DESC;`, []);

        const samplesRow = await this.queryOne(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN ecotaxa_sample_imported = 1 THEN 1 ELSE 0 END) AS imported_to_ecotaxa
             FROM sample;`, []);

        const samplesByQc = await this.queryAll(
            `SELECT vqc.visual_qc_status_label AS label, COUNT(*) AS cnt
             FROM sample s JOIN visual_quality_check_status vqc ON s.visual_qc_status_id = vqc.visual_qc_status_id
             GROUP BY label ORDER BY cnt DESC;`, []);

        const topOrgs = await this.queryAll(
            `SELECT organisation, COUNT(*) AS cnt
             FROM user WHERE deleted IS NULL
             GROUP BY organisation ORDER BY cnt DESC, organisation ASC LIMIT 10;`, []);

        return {
            users: {
                total: n(usersRow?.total),
                admins: n(usersRow?.admins),
                validated_email: n(usersRow?.validated_email),
                pending_validation: n(usersRow?.pending_validation),
                deleted: n(usersRow?.deleted),
                distinct_organisations: n(usersRow?.distinct_organisations),
            },
            projects: {
                total: n(projectsRow?.total),
                backed_up: n(projectsRow?.backed_up),
                linked_to_ecotaxa: n(projectsRow?.linked_to_ecotaxa),
                by_instrument: this.toLabelCounts(byInstrument),
            },
            samples: {
                total: n(samplesRow?.total),
                imported_to_ecotaxa: n(samplesRow?.imported_to_ecotaxa),
                by_qc_status: this.toLabelCounts(samplesByQc),
            },
            tasks: {
                by_type: this.toLabelCounts(tasksByType),
                by_status: this.toLabelCounts(tasksByStatus),
            },
            top_organisations: topOrgs.map((r: any): OrganisationCount => ({ organisation: r.organisation, users: n(r.cnt) })),
        };
    }

    async getEarliestActivityDate(): Promise<string | null> {
        const row = await this.queryOne(
            `SELECT MIN(d) AS earliest FROM (
                SELECT MIN(project_creation_utc_date_time) AS d FROM project
                UNION ALL SELECT MIN(sample_creation_utc_date_time) FROM sample
                UNION ALL SELECT MIN(user_creation_utc_date_time) FROM user
             );`, []);
        return row?.earliest ?? null;
    }

    async getPeriodScalars(from: string, to: string): Promise<StatsPeriodScalarsDbPart> {
        const scalars = await this.queryOne(
            `SELECT
                (SELECT COUNT(*) FROM user WHERE deleted IS NULL AND user_creation_utc_date_time BETWEEN ? AND ?) AS new_users,
                (SELECT COUNT(*) FROM project WHERE project_creation_utc_date_time BETWEEN ? AND ?) AS new_projects,
                (SELECT COUNT(*) FROM sample WHERE sample_creation_utc_date_time BETWEEN ? AND ?) AS new_samples,
                (SELECT COUNT(*) FROM project WHERE project_creation_utc_date_time < ?) AS baseline_projects,
                (SELECT COUNT(*) FROM sample WHERE sample_creation_utc_date_time < ?) AS baseline_samples;`,
            [from, to, from, to, from, to, from, from]);

        const tasksByType = await this.queryAll(
            `SELECT tt.task_type_label AS label, COUNT(*) AS cnt
             FROM task t JOIN task_type tt ON t.task_type_id = tt.task_type_id
             WHERE t.task_creation_utc_date_time BETWEEN ? AND ?
             GROUP BY label ORDER BY cnt DESC;`, [from, to]);

        const tasksByStatus = await this.queryAll(
            `SELECT ts.task_status_label AS label, COUNT(*) AS cnt
             FROM task t JOIN task_status ts ON t.task_status_id = ts.task_status_id
             WHERE t.task_creation_utc_date_time BETWEEN ? AND ?
             GROUP BY label ORDER BY cnt DESC;`, [from, to]);

        return {
            new_users: n(scalars?.new_users),
            new_projects: n(scalars?.new_projects),
            new_samples: n(scalars?.new_samples),
            baseline_projects: n(scalars?.baseline_projects),
            baseline_samples: n(scalars?.baseline_samples),
            tasks_by_type: this.toLabelCounts(tasksByType),
            tasks_by_status: this.toLabelCounts(tasksByStatus),
        };
    }

    async getCreationSeries(from: string, to: string, sqliteFormat: string): Promise<StatsCreationSeriesRow[]> {
        // SQLite generates the ordered interval keys (via strftime) so they match the per-project
        // labels exactly, and fills gaps (intervals with no activity) with zeros.
        const rows = await this.queryAll(
            `WITH RECURSIVE seq(d) AS (
                SELECT date(?)
                UNION ALL
                SELECT date(d, '+1 day') FROM seq WHERE d < date(?)
             ),
             intervals AS (
                SELECT DISTINCT strftime(?, d) AS label FROM seq
             )
             SELECT i.label AS label,
                COALESCE(p.cnt, 0) AS projects,
                COALESCE(s.cnt, 0) AS samples
             FROM intervals i
             LEFT JOIN (
                SELECT strftime(?, project_creation_utc_date_time) AS label, COUNT(*) AS cnt
                FROM project WHERE project_creation_utc_date_time BETWEEN ? AND ?
                GROUP BY label
             ) p ON p.label = i.label
             LEFT JOIN (
                SELECT strftime(?, sample_creation_utc_date_time) AS label, COUNT(*) AS cnt
                FROM sample WHERE sample_creation_utc_date_time BETWEEN ? AND ?
                GROUP BY label
             ) s ON s.label = i.label
             ORDER BY i.label ASC;`,
            [from, to, sqliteFormat, sqliteFormat, from, to, sqliteFormat, from, to]);

        return rows.map((r: any): StatsCreationSeriesRow => ({
            label: r.label,
            projects: n(r.projects),
            samples: n(r.samples),
        }));
    }

    async getProjectsForSizing(from: string, to: string, sqliteFormat: string): Promise<ProjectSizingRow[]> {
        const rows = await this.queryAll(
            `SELECT project_id, root_folder_path,
                CASE WHEN project_creation_utc_date_time < ? THEN 1 ELSE 0 END AS is_baseline,
                CASE WHEN project_creation_utc_date_time BETWEEN ? AND ?
                     THEN strftime(?, project_creation_utc_date_time) ELSE NULL END AS interval_label
             FROM project;`,
            [from, from, to, sqliteFormat]);

        return rows.map((r: any): ProjectSizingRow => ({
            project_id: r.project_id,
            root_folder_path: r.root_folder_path,
            is_baseline: r.is_baseline === 1,
            interval_label: r.interval_label ?? null,
        }));
    }
}
