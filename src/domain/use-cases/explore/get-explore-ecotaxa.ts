import { ExploreEcoTaxaResponse, ExploreRequest } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { GetExploreEcoTaxaUseCase } from "../../interfaces/use-cases/explore/get-explore-ecotaxa";
import { ExploreEcoTaxaService } from "./explore-ecotaxa";
import { ExploreSelectionRepositories, resolveExploreSelection } from "./explore-selection";

// The EcoTaxa part of the two stats tabs: categories used and classification state of the samples.
export class GetExploreEcoTaxa implements GetExploreEcoTaxaUseCase {
    constructor(private readonly repositories: ExploreSelectionRepositories, private readonly ecotaxa: ExploreEcoTaxaService) { }

    async execute(current_user: UserUpdateModel | null, request: ExploreRequest): Promise<ExploreEcoTaxaResponse> {
        const selection = await resolveExploreSelection(this.repositories, current_user, request, (samples, projects, filters) => this.ecotaxa.filterByClassificationState(samples, projects, filters));
        const exclude_not_living = request.filters?.ecotaxa_exclude_not_living ?? false;
        return {
            all: await this.ecotaxa.summaryOf(selection.samples, selection.projects, exclude_not_living),
            exportable: await this.ecotaxa.summaryOf(selection.exportable, selection.projects, exclude_not_living),
        };
    }
}
