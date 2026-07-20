import * as fsPromises from 'fs/promises';
import path from 'path';

import { StatsDataSource } from "../../data/interfaces/data-sources/stats-data-source";
import { StatsRepository } from "../interfaces/repositories/stats-repository";
import {
    AdminStatsResponseModel,
    LabelCount,
    PeriodTasksStats,
    StatsGranularity,
    StatsPeriodOptions,
    StatsSeriePoint,
    TasksStats,
} from "../entities/stats";
import { TasksStatus, TaskType } from "../entities/task";

const EXPORT_TASK_LABELS: string[] = [TaskType.Export, TaskType.Export_Backup, TaskType.Export_Raw];
const IMPORT_TASK_LABELS: string[] = [TaskType.Import, TaskType.Import_Backup, TaskType.Import_CTD, TaskType.Import_EcoTaxa];

const SQLITE_INTERVAL_FORMAT: Record<StatsGranularity, string> = {
    day: '%Y-%m-%d',
    week: '%Y-%W',
    month: '%Y-%m',
};

function totalOf(list: LabelCount[]): number {
    return list.reduce((acc, item) => acc + item.count, 0);
}

function sumWhereLabelIn(list: LabelCount[], labels: string[]): number {
    return list.reduce((acc, item) => (labels.includes(item.label) ? acc + item.count : acc), 0);
}

export class StatsRepositoryImpl implements StatsRepository {
    statsDataSource: StatsDataSource;

    // Same resolution as ProjectRepositoryImpl: project files live at
    // path.join(base_folder, root_folder_path).
    base_folder = path.join(__dirname, '..', '..', '..');

    constructor(statsDataSource: StatsDataSource) {
        this.statsDataSource = statsDataSource;
    }

    async getGlobalStats(options: StatsPeriodOptions): Promise<AdminStatsResponseModel> {
        const generated_at = new Date().toISOString();

        const { from, to } = await this.resolveWindow(options, generated_at);
        const granularity = this.resolveGranularity(from, to, options.granularity);
        const fmt = SQLITE_INTERVAL_FORMAT[granularity];

        const includeStorage = options.include_storage === true;

        const [totalsDb, periodScalars, series] = await Promise.all([
            this.statsDataSource.getTotals(),
            this.statsDataSource.getPeriodScalars(from, to),
            this.statsDataSource.getCreationSeries(from, to, fmt),
        ]);

        // ── Filesystem sizes (attributed by project creation date) ──
        // Expensive: walks every project folder on disk. Only computed on demand
        // (include_storage=true) so the default call stays fast; otherwise sizes are null.
        let storageTotalBytes: number | null = null;
        let baselineSizeBytes: number | null = null;
        const sizeByInterval = new Map<string, number>();
        if (includeStorage) {
            const sizingRows = await this.statsDataSource.getProjectsForSizing(from, to, fmt);
            storageTotalBytes = 0;
            baselineSizeBytes = 0;
            for (const row of sizingRows) {
                const size = await this.directorySize(path.join(this.base_folder, row.root_folder_path));
                storageTotalBytes += size;
                if (row.is_baseline) baselineSizeBytes += size;
                if (row.interval_label) {
                    sizeByInterval.set(row.interval_label, (sizeByInterval.get(row.interval_label) ?? 0) + size);
                }
            }
        }

        // ── Series with running cumulatives (starting from the pre-window baseline) ──
        // Data-size fields stay null unless storage was computed.
        let cumulativeProjects = periodScalars.baseline_projects;
        let cumulativeSamples = periodScalars.baseline_samples;
        let cumulativeSize = baselineSizeBytes ?? 0;
        const seriesOut: StatsSeriePoint[] = series.map(point => {
            const data_size_bytes = includeStorage ? (sizeByInterval.get(point.label) ?? 0) : null;
            cumulativeProjects += point.projects;
            cumulativeSamples += point.samples;
            if (data_size_bytes !== null) cumulativeSize += data_size_bytes;
            return {
                interval: point.label,
                projects_created: point.projects,
                samples_created: point.samples,
                data_size_bytes,
                cumulative_projects: cumulativeProjects,
                cumulative_samples: cumulativeSamples,
                cumulative_data_size_bytes: includeStorage ? cumulativeSize : null,
            };
        });

        const totalsTasks: TasksStats = {
            total: totalOf(totalsDb.tasks.by_type),
            exports: sumWhereLabelIn(totalsDb.tasks.by_type, EXPORT_TASK_LABELS),
            imports: sumWhereLabelIn(totalsDb.tasks.by_type, IMPORT_TASK_LABELS),
            running: sumWhereLabelIn(totalsDb.tasks.by_status, [TasksStatus.Running]),
            failed: sumWhereLabelIn(totalsDb.tasks.by_status, [TasksStatus.Error]),
            by_type: totalsDb.tasks.by_type,
            by_status: totalsDb.tasks.by_status,
        };

        const periodTasks: PeriodTasksStats = {
            total: totalOf(periodScalars.tasks_by_type),
            exports: sumWhereLabelIn(periodScalars.tasks_by_type, EXPORT_TASK_LABELS),
            by_type: periodScalars.tasks_by_type,
            by_status: periodScalars.tasks_by_status,
        };

        return {
            generated_at,
            totals: {
                users: totalsDb.users,
                projects: totalsDb.projects,
                tasks: totalsTasks,
                samples: totalsDb.samples,
                storage: { total_size_bytes: storageTotalBytes },
                top_organisations: totalsDb.top_organisations,
            },
            period: {
                from,
                to,
                granularity,
                new_users: periodScalars.new_users,
                new_projects: periodScalars.new_projects,
                new_samples: periodScalars.new_samples,
                tasks: periodTasks,
                baseline: {
                    projects: periodScalars.baseline_projects,
                    samples: periodScalars.baseline_samples,
                    data_size_bytes: baselineSizeBytes,
                },
                series: seriesOut,
            },
        };
    }

    // Resolve the [from, to] window. `to` defaults to now; a date-only `to` is extended to the
    // end of that day so same-day timestamps are included. `from` defaults to the earliest
    // activity date (whole history).
    private async resolveWindow(options: StatsPeriodOptions, nowISO: string): Promise<{ from: string; to: string }> {
        let to = options.to ?? nowISO;
        if (to.length === 10) to = `${to}T23:59:59.999Z`;

        let from = options.from;
        if (!from) {
            from = (await this.statsDataSource.getEarliestActivityDate()) ?? nowISO;
        }
        return { from, to };
    }

    private resolveGranularity(fromISO: string, toISO: string, requested?: StatsGranularity): StatsGranularity {
        if (requested) return requested;
        const spanDays = (Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000;
        if (!Number.isFinite(spanDays) || spanDays <= 92) return 'day';
        if (spanDays <= 730) return 'week';
        return 'month';
    }

    // Recursive on-disk size of a directory (bytes). Tolerant: a missing/unreadable path or entry
    // contributes 0. Symlinks are skipped to avoid cycles.
    private async directorySize(absolutePath: string): Promise<number> {
        let entries;
        try {
            entries = await fsPromises.readdir(absolutePath, { withFileTypes: true });
        } catch {
            return 0;
        }
        let total = 0;
        for (const entry of entries) {
            const full = path.join(absolutePath, entry.name);
            try {
                if (entry.isDirectory()) {
                    total += await this.directorySize(full);
                } else if (entry.isFile()) {
                    const stat = await fsPromises.stat(full);
                    total += stat.size;
                }
            } catch {
                // Skip entries that disappear or cannot be stat-ed mid-walk.
            }
        }
        return total;
    }
}
