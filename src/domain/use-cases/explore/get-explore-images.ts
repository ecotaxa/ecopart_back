import { ExploreImage, ExploreImagesRequest } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { GetExploreImagesUseCase } from "../../interfaces/use-cases/explore/get-explore-images";
import { ExploreEcoTaxaService, EXPLORE_IMAGES_DEFAULT, EXPLORE_IMAGES_MAX } from "./explore-ecotaxa";
import { ExploreSelectionRepositories, resolveExploreSelection } from "./explore-selection";

// A few random object images of the selection, from EcoTaxa; called again to refresh them.
export class GetExploreImages implements GetExploreImagesUseCase {
    constructor(private readonly repositories: ExploreSelectionRepositories, private readonly ecotaxa: ExploreEcoTaxaService) { }

    async execute(current_user: UserUpdateModel | null, request: ExploreImagesRequest): Promise<ExploreImage[]> {
        const count = request.count ?? EXPLORE_IMAGES_DEFAULT;
        if (!Number.isInteger(count) || count < 1 || count > EXPLORE_IMAGES_MAX) throw new Error(`count must be between 1 and ${EXPLORE_IMAGES_MAX}`);
        const selection = await resolveExploreSelection(this.repositories, current_user, request, (samples, projects, filters) => this.ecotaxa.filterByClassificationState(samples, projects, filters));
        return this.ecotaxa.randomImagesOf(selection.samples, selection.projects, count);
    }
}
