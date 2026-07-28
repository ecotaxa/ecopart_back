import { AdminStatsResponseModel, StatsPeriodOptions } from "../../entities/stats";

export interface StatsRepository {
    getGlobalStats(options: StatsPeriodOptions): Promise<AdminStatsResponseModel>;
}
