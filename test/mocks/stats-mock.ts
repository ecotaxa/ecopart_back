import { AdminStatsResponseModel } from "../../src/domain/entities/stats";
import { StatsRepository } from "../../src/domain/interfaces/repositories/stats-repository";
import { GetStatsUseCase } from "../../src/domain/interfaces/use-cases/admin/get-stats";
import { ComputeParticleStatsUseCase } from "../../src/domain/interfaces/use-cases/sample/compute-particle-stats";
import { PublicTaskResponseModel } from "../../src/domain/entities/task";

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

export class MockComputeParticleStatsUseCase implements ComputeParticleStatsUseCase {
    execute(): Promise<PublicTaskResponseModel> {
        throw new Error("Method not implemented : execute");
    }
}
