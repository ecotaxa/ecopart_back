import { ExploreGraphs, ExploreGraphsRequest, ExploreSampleRow, GraphDataset } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { CTD_PRESSURE_COLUMN, CTD_TIME_COLUMN } from "../../utils/ctd-rows";
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

    async execute(current_user: UserUpdateModel | null, request: ExploreGraphsRequest): Promise<ExploreGraphs> {
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

        const datasets = buildParticleDatasets(particles.filter((entry): entry is { sample: ExploreSampleRow; bins: ParticleBins } => entry !== null), size_classes);
        const ctd_read = ctd.filter((entry): entry is { sample: ExploreSampleRow; bins: CtdBins } => entry !== null);
        return {
            size_classes,
            abundance: datasets.abundance,
            biovolume: datasets.biovolume,
            ctd: buildCtdDataset(ctd_read),
            ecotaxa: EMPTY_DATASET,
            warnings,
            ctd_warnings: ctdWarnings(axis, drawn.length, with_ctd.length, ctd_failures, ctd_read),
        };
    }
}

// An empty CTD graph looks broken: these say which samples have no CTD curve and why.
function ctdWarnings(axis: BinAxis, drawn: number, with_ctd: number, failures: string[], read: { sample: ExploreSampleRow; bins: CtdBins }[]): string[] {
    const warnings: string[] = [];
    const without_ctd = drawn - with_ctd;
    if (drawn > 0 && with_ctd === 0) {
        warnings.push(`${drawn === 1 ? "The sample drawn has no" : `None of the ${drawn} samples drawn has`} CTD data imported: CTD files are imported from the Import tab of the project`);
    } else if (without_ctd > 0) {
        warnings.push(`${without_ctd} of the ${drawn} samples drawn ${without_ctd > 1 ? "have" : "has"} no CTD data imported`);
    }
    if (failures.length > 0) warnings.push(`${failures.length} CTD file${failures.length > 1 ? "s" : ""} could not be read: ${describe(failures)}`);
    // A file read without a single bin lacks the column of the axis (a profile CTD has no time column).
    const unplaced = read.filter(({ bins }) => bins.positions.length === 0).map(({ sample }) => sample.sample_name);
    if (unplaced.length > 0) {
        const column = axis === "depth" ? CTD_PRESSURE_COLUMN : CTD_TIME_COLUMN;
        warnings.push(`${unplaced.length} CTD file${unplaced.length > 1 ? "s have" : " has"} no "${column}" value, so ${unplaced.length > 1 ? "they cannot" : "it cannot"} be drawn ${axis === "depth" ? "on depth" : "over time"}: ${describe(unplaced)}`);
    }
    return warnings;
}

function describe(names: string[]): string {
    const shown = names.slice(0, NAMES_IN_WARNING).join(", ");
    return names.length > NAMES_IN_WARNING ? `${shown} and ${names.length - NAMES_IN_WARNING} more` : shown;
}
