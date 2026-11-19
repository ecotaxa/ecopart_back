import { ExploreEcoTaxaGraphs, ExploreEcoTaxaGraphsRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

// current_user is null for an anonymous caller.
export interface GetExploreEcoTaxaGraphsUseCase {
    execute(current_user: UserUpdateModel | null, request: ExploreEcoTaxaGraphsRequest): Promise<ExploreEcoTaxaGraphs>;
}
