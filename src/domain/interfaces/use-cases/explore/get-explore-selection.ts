import { ExploreRequest, ExploreSelectionResponse } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

export interface GetExploreSelectionUseCase {
    execute(current_user: UserUpdateModel, request: ExploreRequest): Promise<ExploreSelectionResponse>;
}
