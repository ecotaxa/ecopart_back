import { UserUpdateModel } from "../../../entities/user";
import { AdminStatsResponseModel, StatsPeriodOptions } from "../../../entities/stats";

export interface GetStatsUseCase {
    execute(current_user: UserUpdateModel, options: StatsPeriodOptions): Promise<AdminStatsResponseModel>;
}
