import { ExploreEcoTaxaResponse, ExploreRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

export interface GetExploreEcoTaxaUseCase {
    execute(current_user: UserUpdateModel, request: ExploreRequest): Promise<ExploreEcoTaxaResponse>;
}
