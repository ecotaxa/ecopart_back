import { ExploreGraphs, ExploreGraphsRequest, ExploreSampleRow, GraphDataset } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { GetExploreGraphsUseCase } from "../../interfaces/use-cases/explore/get-explore-graphs";
import { BinAxis } from "../export/binned-computation";
import { ExploreEcoTaxaService } from "./explore-ecotaxa";
import { binCtdRows, buildCtdDataset, buildParticleDatasets, CtdBins, EXPLORE_GRAPH_CONCURRENCY, EXPLORE_GRAPH_MAX_SAMPLES, ExploreParticleBins, exploreGraphSteps, mapWithConcurrency, ReducedBins } from "./explore-graphs";
import { ExploreProjectContext, ExploreSelectionRepositories, resolveExploreSelection } from "./explore-selection";

const EMPTY_DATASET: GraphDataset = { keys: [], axis_labels: {}, series: {} };
const NAMES_IN_WARNING = 5;

// The curves of the selection: one per sample whose project lets the user see figures (members and
// managers always, anyone once the project is visible), on the axis of the page.
export class GetExploreGraphs implements GetExploreGraphsUseCase {
    constructor(
        private readonly repositories: ExploreSelectionRepositories,
        private readonly ecotaxa: ExploreEcoTaxaService,
        private readonly particleBins: ExploreParticleBins,
    ) { }

    async execute(current_user: UserUpdateModel | null, request: ExploreGraphsRequest): Promise<ExploreGraphs> {
        if (!current_user) throw new Error("Login required");
        const steps = exploreGraphSteps(request.pressure_bin, request.time_bin);
        const selection = await resolveExploreSelection(this.repositories, current_user, request, (samples, projects, filters) => this.ecotaxa.filterByClassificationState(samples, projects, filters));
        const axis: BinAxis = request.mode;
        const step = axis === "depth" ? steps.pressure_bin : steps.time_bin;
        const warnings: string[] = [];

        const allowed = selection.samples.filter(sample => selection.projects.get(sample.project_id)?.can_figures);
        const hidden = selection.samples.length - allowed.length;
        if (hidden > 0) warnings.push(`${hidden} sample${hidden > 1 ? "s" : ""} of private projects ${hidden > 1 ? "are" : "is"} not drawn`);
        const drawn = allowed.slice(0, EXPLORE_GRAPH_MAX_SAMPLES);
        if (drawn.length < allowed.length) warnings.push(`Only the first ${EXPLORE_GRAPH_MAX_SAMPLES} of the ${allowed.length} samples are drawn: narrow the selection`);

        const contextOf = (sample: ExploreSampleRow) => selection.projects.get(sample.project_id) as ExploreProjectContext;
        const particle_failures: string[] = [];
        const particles = await mapWithConcurrency(drawn, EXPLORE_GRAPH_CONCURRENCY, async (sample): Promise<{ sample: ExploreSampleRow; bins: ReducedBins } | null> => {
            try {
                return { sample, bins: await this.particleBins.binsOf(sample, contextOf(sample), axis, step) };
            } catch (error) {
                particle_failures.push(sample.sample_name);
                console.log(new Date().toISOString(), `Explore graphs: sample ${sample.sample_name} skipped`, (error as Error).message);
                return null;
            }
        });
        if (particle_failures.length > 0) warnings.push(`${particle_failures.length} sample${particle_failures.length > 1 ? "s" : ""} without readable particle data: ${describe(particle_failures)}`);

        const with_ctd = drawn.filter(sample => sample.ctd_imported && sample.ctd_file_extension);
        const ctd_failures: string[] = [];
        const ctd = await mapWithConcurrency(with_ctd, EXPLORE_GRAPH_CONCURRENCY, async (sample): Promise<{ sample: ExploreSampleRow; bins: CtdBins } | null> => {
            try {
                const context = contextOf(sample);
                const rows = await this.repositories.sampleRepository.getCtdRows(sample.project_id, sample.sample_name, sample.ctd_file_extension as string);
                return { sample, bins: binCtdRows(rows, axis, step, axis === "depth" && context.project.enable_descent_filter) };
            } catch (error) {
                ctd_failures.push(sample.sample_name);
                console.log(new Date().toISOString(), `Explore graphs: CTD of sample ${sample.sample_name} skipped`, (error as Error).message);
                return null;
            }
        });
        if (ctd_failures.length > 0) warnings.push(`${ctd_failures.length} CTD file${ctd_failures.length > 1 ? "s" : ""} could not be read: ${describe(ctd_failures)}`);

        const datasets = buildParticleDatasets(particles.filter((entry): entry is { sample: ExploreSampleRow; bins: ReducedBins } => entry !== null));
        return {
            abundance: datasets.abundance,
            biovolume: datasets.biovolume,
            ctd: buildCtdDataset(ctd.filter((entry): entry is { sample: ExploreSampleRow; bins: CtdBins } => entry !== null)),
            ecotaxa: EMPTY_DATASET,
            warnings,
        };
    }
}

function describe(names: string[]): string {
    const shown = names.slice(0, NAMES_IN_WARNING).join(", ");
    return names.length > NAMES_IN_WARNING ? `${shown} and ${names.length - NAMES_IN_WARNING} more` : shown;
}
