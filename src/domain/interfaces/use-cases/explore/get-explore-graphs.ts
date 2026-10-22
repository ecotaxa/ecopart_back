import { ExploreGraphs, ExploreGraphsRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

// current_user is null for an anonymous caller.
export interface GetExploreGraphsUseCase {
    execute(current_user: UserUpdateModel | null, request: ExploreGraphsRequest): Promise<ExploreGraphs>;
}
