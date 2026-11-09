import { ExploreRequest, ExploreSelectionResponse } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

// current_user is null for an anonymous caller.
export interface GetExploreSelectionUseCase {
    execute(current_user: UserUpdateModel | null, request: ExploreRequest): Promise<ExploreSelectionResponse>;
}
