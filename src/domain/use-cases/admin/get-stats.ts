import { UserUpdateModel } from "../../entities/user";
import { AdminStatsResponseModel, StatsPeriodOptions } from "../../entities/stats";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { StatsRepository } from "../../interfaces/repositories/stats-repository";
import { GetStatsUseCase } from "../../interfaces/use-cases/admin/get-stats";

export class GetStats implements GetStatsUseCase {
    userRepository: UserRepository
    statsRepository: StatsRepository

    constructor(userRepository: UserRepository, statsRepository: StatsRepository) {
        this.userRepository = userRepository
        this.statsRepository = statsRepository
    }

    async execute(current_user: UserUpdateModel, options: StatsPeriodOptions): Promise<AdminStatsResponseModel> {
        // Authorization: only an admin (whose account is usable) may read application statistics.
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) throw new Error("Logged user cannot access statistics");

        return await this.statsRepository.getGlobalStats(options);
    }
}
