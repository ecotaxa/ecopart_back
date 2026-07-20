import { AdminStatsResponseModel } from "../../src/domain/entities/stats";
import { StatsRepository } from "../../src/domain/interfaces/repositories/stats-repository";
import { GetStatsUseCase } from "../../src/domain/interfaces/use-cases/admin/get-stats";

export class MockStatsRepository implements StatsRepository {
    getGlobalStats(): Promise<AdminStatsResponseModel> {
        throw new Error("Method not implemented : getGlobalStats");
    }
}

export class MockGetStatsUseCase implements GetStatsUseCase {
    execute(): Promise<AdminStatsResponseModel> {
        throw new Error("Method not implemented : execute");
    }
}
