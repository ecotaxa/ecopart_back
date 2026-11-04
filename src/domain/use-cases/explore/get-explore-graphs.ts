import { ExploreGraphs, ExploreGraphsRequest, ExploreSampleRow, GraphDataset } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { GetExploreGraphsUseCase } from "../../interfaces/use-cases/explore/get-explore-graphs";
import { BinAxis } from "../export/binned-computation";
import { ExploreEcoTaxaService } from "./explore-ecotaxa";
import { buildCtdDataset, buildParticleDatasets, CtdBins, EXPLORE_GRAPH_CONCURRENCY, EXPLORE_GRAPH_MAX_DETAILED_SAMPLES, EXPLORE_GRAPH_MAX_SAMPLES, ExploreCtdBins, ExploreParticleBins, exploreGraphSteps, exploreSizeClasses, mapWithConcurrency, ParticleBins } from "./explore-graphs";
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
        private readonly ctdBins: ExploreCtdBins,
    ) { }

    async execute(current_user: UserUpdateModel, request: ExploreGraphsRequest): Promise<ExploreGraphs> {
        const steps = exploreGraphSteps(request.pressure_bin, request.time_bin);
        const size_classes = exploreSizeClasses(request.size_classes);
        const selection = await resolveExploreSelection(this.repositories, current_user, request, (samples, projects, filters) => this.ecotaxa.filterByClassificationState(samples, projects, filters));
        const axis: BinAxis = request.mode;
        const step = axis === "depth" ? steps.pressure_bin : steps.time_bin;
        const warnings: string[] = [];

        const allowed = selection.samples.filter(sample => selection.projects.get(sample.project_id)?.can_figures);
        const hidden = selection.samples.length - allowed.length;
        if (hidden > 0) warnings.push(`${hidden} sample${hidden > 1 ? "s" : ""} of private projects ${hidden > 1 ? "are" : "is"} not drawn`);
        const max_samples = size_classes === "detailed" ? EXPLORE_GRAPH_MAX_DETAILED_SAMPLES : EXPLORE_GRAPH_MAX_SAMPLES;
        const drawn = allowed.slice(0, max_samples);
        if (drawn.length < allowed.length) warnings.push(size_classes === "detailed"
            ? `Only the first ${max_samples} of the ${allowed.length} samples are drawn with the detailed histogram: narrow the selection or use the reduced one`
            : `Only the first ${max_samples} of the ${allowed.length} samples are drawn: narrow the selection`);

        const contextOf = (sample: ExploreSampleRow) => selection.projects.get(sample.project_id) as ExploreProjectContext;
        const particle_failures: string[] = [];
        const ctd_failures: string[] = [];
        const with_ctd = drawn.filter(sample => sample.ctd_imported && sample.ctd_file_extension);
        // The particle files and the CTD files are read side by side.
        const [particles, ctd] = await Promise.all([
            mapWithConcurrency(drawn, EXPLORE_GRAPH_CONCURRENCY, async (sample): Promise<{ sample: ExploreSampleRow; bins: ParticleBins } | null> => {
                try {
                    return { sample, bins: await this.particleBins.binsOf(sample, contextOf(sample), axis, step) };
                } catch (error) {
                    particle_failures.push(sample.sample_name);
                    console.log(new Date().toISOString(), `Explore graphs: sample ${sample.sample_name} skipped`, (error as Error).message);
                    return null;
                }
            }),
            mapWithConcurrency(with_ctd, EXPLORE_GRAPH_CONCURRENCY, async (sample): Promise<{ sample: ExploreSampleRow; bins: CtdBins } | null> => {
                try {
                    const descent_filter = axis === "depth" && contextOf(sample).project.enable_descent_filter;
                    return { sample, bins: await this.ctdBins.binsOf(sample, sample.ctd_file_extension as string, axis, step, descent_filter) };
                } catch (error) {
                    ctd_failures.push(sample.sample_name);
                    console.log(new Date().toISOString(), `Explore graphs: CTD of sample ${sample.sample_name} skipped`, (error as Error).message);
                    return null;
                }
            }),
        ]);
        if (particle_failures.length > 0) warnings.push(`${particle_failures.length} sample${particle_failures.length > 1 ? "s" : ""} without readable particle data: ${describe(particle_failures)}`);
        if (ctd_failures.length > 0) warnings.push(`${ctd_failures.length} CTD file${ctd_failures.length > 1 ? "s" : ""} could not be read: ${describe(ctd_failures)}`);

        const datasets = buildParticleDatasets(particles.filter((entry): entry is { sample: ExploreSampleRow; bins: ParticleBins } => entry !== null), size_classes);
        return {
            size_classes,
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
