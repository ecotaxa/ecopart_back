import { ExploreEcoTaxaGraphs, ExploreEcoTaxaGraphsRequest, ExploreSampleRow } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { GetExploreEcoTaxaGraphsUseCase } from "../../interfaces/use-cases/explore/get-explore-ecotaxa-graphs";
import { buildEcoTaxaDataset, ECOTAXA_HISTOGRAM_STEP_M, EcoTaxaGraphSample } from "./explore-ecotaxa-graphs";
import { ExploreEcoTaxaService } from "./explore-ecotaxa";
import { EXPLORE_GRAPH_CONCURRENCY, EXPLORE_GRAPH_MAX_SAMPLES, ExploreParticleBins, mapWithConcurrency } from "./explore-graphs";
import { ExploreProjectContext, ExploreSelectionRepositories, resolveExploreSelection } from "./explore-selection";

const NAMES_IN_WARNING = 5;

// The concentrations per EcoTaxa category of the depth profiles of the selection, on the samples whose
// project lets the user see figures, as the particle curves. The objects come from the histograms the
// EcoTaxa service keeps, the water volume from the particle bins of the same depths.
export class GetExploreEcoTaxaGraphs implements GetExploreEcoTaxaGraphsUseCase {
    constructor(
        private readonly repositories: ExploreSelectionRepositories,
        private readonly ecotaxa: ExploreEcoTaxaService,
        private readonly particleBins: ExploreParticleBins,
    ) { }

    async execute(current_user: UserUpdateModel | null, request: ExploreEcoTaxaGraphsRequest): Promise<ExploreEcoTaxaGraphs> {
        const include_predicted = request.include_predicted ?? false;
        const sum_child_taxa = request.sum_child_taxa ?? false;
        const selection = await resolveExploreSelection(this.repositories, current_user, { mode: "depth", filters: request.filters }, (samples, projects, filters) => this.ecotaxa.filterByClassificationState(samples, projects, filters));
        const warnings: string[] = [];

        const allowed = selection.samples.filter(sample => selection.projects.get(sample.project_id)?.can_figures);
        const hidden = selection.samples.length - allowed.length;
        if (hidden > 0) warnings.push(`${hidden} sample${hidden > 1 ? "s" : ""} of private projects ${hidden > 1 ? "are" : "is"} not drawn`);
        const drawn = allowed.slice(0, EXPLORE_GRAPH_MAX_SAMPLES);
        if (drawn.length < allowed.length) warnings.push(`Only the first ${EXPLORE_GRAPH_MAX_SAMPLES} of the ${allowed.length} samples are drawn: narrow the selection`);

        const ecotaxa = await this.ecotaxa.histogramsOf(drawn, selection.projects);
        const in_ecotaxa = ecotaxa.in_ecotaxa.size;
        if (drawn.length > 0 && in_ecotaxa === 0) warnings.push(`${drawn.length === 1 ? "The sample drawn is not" : `None of the ${drawn.length} samples drawn is`} imported in EcoTaxa`);
        else if (in_ecotaxa < drawn.length) warnings.push(`${drawn.length - in_ecotaxa} of the ${drawn.length} samples drawn ${drawn.length - in_ecotaxa > 1 ? "are" : "is"} not imported in EcoTaxa`);
        if (ecotaxa.pending > 0) warnings.push(`The objects of ${ecotaxa.pending} sample${ecotaxa.pending > 1 ? "s are" : " is"} being read from EcoTaxa: the curves complete in a moment`);

        // The water volume of the samples with objects, from their particle bins.
        const with_objects = drawn.filter(sample => (ecotaxa.histograms.get(sample.sample_id)?.bins.length ?? 0) > 0);
        const contextOf = (sample: ExploreSampleRow) => selection.projects.get(sample.project_id) as ExploreProjectContext;
        const failures: string[] = [];
        const read = await mapWithConcurrency(with_objects, EXPLORE_GRAPH_CONCURRENCY, async (sample): Promise<EcoTaxaGraphSample | null> => {
            try {
                const bins = await this.particleBins.binsOf(sample, contextOf(sample), "depth", ECOTAXA_HISTOGRAM_STEP_M);
                return {
                    sample,
                    bins: ecotaxa.histograms.get(sample.sample_id)?.bins ?? [],
                    volumes: { positions: bins.positions, volumes: bins.volumes },
                    taxonOf: (classif_id) => ecotaxa.taxonOf(sample.sample_id, classif_id),
                };
            } catch (error) {
                failures.push(sample.sample_name);
                console.log(new Date().toISOString(), `Explore EcoTaxa graphs: sample ${sample.sample_name} skipped`, (error as Error).message);
                return null;
            }
        });
        if (failures.length > 0) warnings.push(`${failures.length} sample${failures.length > 1 ? "s have" : " has"} no readable particle data, so no water volume: ${describe(failures)}`);

        const dataset = buildEcoTaxaDataset(read.filter((entry): entry is EcoTaxaGraphSample => entry !== null), {
            include_predicted, sum_child_taxa, exclude_not_living: request.filters?.ecotaxa_exclude_not_living ?? false,
        });
        if (dataset.keys.length === 0 && !include_predicted && with_objects.some(sample => ecotaxa.histograms.get(sample.sample_id)?.bins.some(bin => bin.nb_predicted > 0))) {
            warnings.push("The samples drawn have no validated object: include the predicted objects to draw them");
        }
        return { ...dataset, warnings, nb_samples_pending: ecotaxa.pending };
    }
}

function describe(names: string[]): string {
    const shown = names.slice(0, NAMES_IN_WARNING).join(", ");
    return names.length > NAMES_IN_WARNING ? `${shown} and ${names.length - NAMES_IN_WARNING} more` : shown;
}
