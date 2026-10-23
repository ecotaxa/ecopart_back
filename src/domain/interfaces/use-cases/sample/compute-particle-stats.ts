import { PublicTaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface ComputeParticleStatsRequestModel {
    project_ids?: number[];     // empty or absent: every project
    force?: boolean;            // also recompute the samples that already have their statistics
}

export interface ComputeParticleStatsUseCase {
    execute(current_user: UserUpdateModel, request: ComputeParticleStatsRequestModel): Promise<PublicTaskResponseModel>;
}
