// Admin application statistics — shapes returned by GET /admin/stats.
// `totals` is the current point-in-time state (ignores the period); `period` is the
// activity within the selected [from, to] window, including time series for charts.

export type StatsGranularity = 'day' | 'week' | 'month';

// Options parsed from the query string (all optional). Defaults are resolved in the repository:
// to = now, from = earliest activity date, granularity = auto (from the span).
// `include_storage` (default false) gates the expensive on-disk size computation (a filesystem
// walk of every project folder) — off by default so the endpoint stays fast; turned on on demand.
export interface StatsPeriodOptions {
    from?: string;
    to?: string;
    granularity?: StatsGranularity;
    include_storage?: boolean;
}

// A generic "label -> count" bucket used for GROUP BY breakdowns.
export interface LabelCount {
    label: string;
    count: number;
}

export interface OrganisationCount {
    organisation: string;
    users: number;
}

export interface UsersStats {
    total: number;                 // active users (deleted IS NULL)
    admins: number;
    validated_email: number;
    pending_validation: number;
    deleted: number;               // soft-deleted (deleted IS NOT NULL)
    distinct_organisations: number;
}

export interface ProjectsStats {
    total: number;
    backed_up: number;             // last_backup_utc_date_time IS NOT NULL
    linked_to_ecotaxa: number;     // ecotaxa_project_id IS NOT NULL
    by_instrument: LabelCount[];
}

export interface TasksStats {
    total: number;
    exports: number;               // EXPORT | EXPORT_BACKUP | EXPORT_RAW
    imports: number;               // IMPORT | IMPORT_BACKUP | IMPORT_CTD | IMPORT_ECO_TAXA
    running: number;
    failed: number;
    by_type: LabelCount[];
    by_status: LabelCount[];
}

export interface SamplesStats {
    total: number;
    imported_to_ecotaxa: number;   // ecotaxa_sample_imported = 1
    by_qc_status: LabelCount[];    // PENDING | VALIDATED | REJECTED
}

export interface StorageStats {
    // Sum of on-disk project folder sizes. `null` when not computed (include_storage=false).
    total_size_bytes: number | null;
}

// One point of the period time series (one per interval; gaps are filled with zeros).
// The data-size fields are `null` unless storage was requested (include_storage=true).
export interface StatsSeriePoint {
    interval: string;                    // interval key, e.g. "2026-01" | "2026-01-15"
    projects_created: number;
    samples_created: number;
    data_size_bytes: number | null;      // data added in this interval (by project creation)
    cumulative_projects: number;         // running total, includes the pre-window baseline
    cumulative_samples: number;
    cumulative_data_size_bytes: number | null;
}

export interface PeriodTasksStats {
    total: number;
    exports: number;
    by_type: LabelCount[];
    by_status: LabelCount[];
}

export interface PeriodBaseline {
    projects: number;              // created strictly before `from`
    samples: number;
    data_size_bytes: number | null;   // null when storage was not computed
}

export interface PeriodStats {
    from: string;                  // resolved window bounds
    to: string;
    granularity: StatsGranularity; // resolved granularity
    new_users: number;
    new_projects: number;
    new_samples: number;
    tasks: PeriodTasksStats;
    baseline: PeriodBaseline;
    series: StatsSeriePoint[];
}

export interface AdminStatsResponseModel {
    generated_at: string;          // ISO timestamp of computation
    totals: {
        users: UsersStats;
        projects: ProjectsStats;
        tasks: TasksStats;
        samples: SamplesStats;
        storage: StorageStats;
        top_organisations: OrganisationCount[];
    };
    period: PeriodStats;
}
