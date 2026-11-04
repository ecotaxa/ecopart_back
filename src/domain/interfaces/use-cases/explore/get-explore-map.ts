import { ExploreMapSample, ExploreRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

export interface GetExploreMapUseCase {
    execute(current_user: UserUpdateModel, request: ExploreRequest): Promise<ExploreMapSample[]>;
}
