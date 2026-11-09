import { ExploreRequest, ExploreSelectionResponse } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { GetExploreSelectionUseCase } from "../../interfaces/use-cases/explore/get-explore-selection";
import { ExploreEcoTaxaService } from "./explore-ecotaxa";
import { ExploreSelectionRepositories, resolveExploreSelection } from "./explore-selection";
import { buildExploreSelection } from "./explore-stats";

// The "Selected data stats" tab (every matching sample) and the "Exportable selection" tab (the
// samples the user may export), from one resolution of the selection.
export class GetExploreSelection implements GetExploreSelectionUseCase {
    constructor(private readonly repositories: ExploreSelectionRepositories, private readonly ecotaxa: ExploreEcoTaxaService) { }

    async execute(current_user: UserUpdateModel | null, request: ExploreRequest): Promise<ExploreSelectionResponse> {
        const selection = await resolveExploreSelection(this.repositories, current_user, request, (samples, projects, filters) => this.ecotaxa.filterByClassificationState(samples, projects, filters));
        return {
            all: buildExploreSelection(selection.samples, selection.projects, selection.user),
            exportable: buildExploreSelection(selection.exportable, selection.projects, selection.user),
        };
    }
}
