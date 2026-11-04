import { ExploreGraphs, ExploreGraphsRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

export interface GetExploreGraphsUseCase {
    execute(current_user: UserUpdateModel, request: ExploreGraphsRequest): Promise<ExploreGraphs>;
}
