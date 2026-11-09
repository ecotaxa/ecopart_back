import { ExploreMapSample, ExploreRequest } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { GetExploreMapUseCase } from "../../interfaces/use-cases/explore/get-explore-map";
import { ExploreEcoTaxaService } from "./explore-ecotaxa";
import { ExploreSelectionRepositories, resolveExploreSelection } from "./explore-selection";
import { buildExploreMap } from "./explore-stats";

export class GetExploreMap implements GetExploreMapUseCase {
    constructor(private readonly repositories: ExploreSelectionRepositories, private readonly ecotaxa: ExploreEcoTaxaService) { }

    async execute(current_user: UserUpdateModel | null, request: ExploreRequest): Promise<ExploreMapSample[]> {
        const selection = await resolveExploreSelection(this.repositories, current_user, request, (samples, projects, filters) => this.ecotaxa.filterByClassificationState(samples, projects, filters));
        return buildExploreMap(selection.samples, selection.projects);
    }
}
