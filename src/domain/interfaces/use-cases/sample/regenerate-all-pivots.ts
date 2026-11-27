import { PublicTaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface RegenerateAllPivotsRequestModel {
    project_ids?: number[];     // empty or absent: every UVP5 project
    force?: boolean;            // also rebuild the pivots already at the current converter version
}

export interface RegenerateAllPivotsUseCase {
    execute(current_user: UserUpdateModel, request: RegenerateAllPivotsRequestModel): Promise<PublicTaskResponseModel>;
}
