import { ExploreMapSample, ExploreRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

// current_user is null for an anonymous caller.
export interface GetExploreMapUseCase {
    execute(current_user: UserUpdateModel | null, request: ExploreRequest): Promise<ExploreMapSample[]>;
}
