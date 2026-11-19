import { EcoTaxaTaxon } from "../../../../src/domain/entities/ecotaxa_account";
import { ExploreSampleRow, StoredEcoTaxaHistogram } from "../../../../src/domain/entities/explore";
import { SIZE_CLASS_COUNT } from "../../../../src/domain/constants/size-classes";
import { EcoTaxaHistograms, ExploreEcoTaxaService } from "../../../../src/domain/use-cases/explore/explore-ecotaxa";
import { EXPLORE_GRAPH_MAX_SAMPLES, ExploreParticleBins, ParticleBins } from "../../../../src/domain/use-cases/explore/explore-graphs";
import { ExploreSelectionRepositories } from "../../../../src/domain/use-cases/explore/explore-selection";
import { GetExploreEcoTaxaGraphs } from "../../../../src/domain/use-cases/explore/get-explore-ecotaxa-graphs";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { ALICE, CAROL, exploreFilters, exploreProject, exploreSample, privileges } from "./explore-fixtures";

const OPEN = exploreProject(1, "open", { project_title: "Ligurian profiles" });
const PRIVATE = exploreProject(2, "private", { project_title: "Arctic moorings" });
const VISIBLE = exploreProject(3, "visible", { project_title: "Tara Pacific" });

const TAXA: Record<number, EcoTaxaTaxon> = {
    10: { id: 10, name: "Copepoda", display_name: "Copepoda", id_lineage: [10, 85, 1], nb_objects: 0 },
    11: { id: 11, name: "Calanoida", display_name: "Calanoida", id_lineage: [11, 10, 85, 1], nb_objects: 0 },
    20: { id: 20, name: "detritus", display_name: "detritus", id_lineage: [20, 84963], nb_objects: 0 },
};

// One 5 m bin of 2 litres at 0-5 m.
const BINS: ParticleBins = {
    positions: [2.5],
    volumes: [2],
    counts: [Array.from({ length: SIZE_CLASS_COUNT }, () => 0)],
    biovolumes_mm3: [Array.from({ length: SIZE_CLASS_COUNT }, () => 0)],
    visible: Array.from({ length: SIZE_CLASS_COUNT }, () => true),
};

const sample = (sample_id: number, project_id: number, overrides: Partial<ExploreSampleRow> = {}) =>
    exploreSample({ sample_id, project_id, sample_name: `moose_${String(sample_id).padStart(3, "0")}`, ...overrides });

const histogram = (sample_id: number, bins: StoredEcoTaxaHistogram["bins"]): StoredEcoTaxaHistogram => ({
    sample_id, ecotaxa_sample_id: 9000 + sample_id, depth_offset_m: 1.2, nb_validated: 0, nb_predicted: 0, bins, fetched_utc_date_time: "2026-11-19T08:00:00.000Z",
});

describe("GetExploreEcoTaxaGraphs", () => {
    let userRepository: MockUserRepository;
    let projectRepository: MockProjectRepository;
    let privilegeRepository: MockPrivilegeRepository;
    let sampleRepository: MockSampleRepository;
    let repositories: ExploreSelectionRepositories;
    let ecotaxa: ExploreEcoTaxaService;
    let particleBins: ExploreParticleBins;
    let useCase: GetExploreEcoTaxaGraphs;
    let samples: ExploreSampleRow[];
    let answer: EcoTaxaHistograms;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        userRepository = new MockUserRepository();
        projectRepository = new MockProjectRepository();
        privilegeRepository = new MockPrivilegeRepository();
        sampleRepository = new MockSampleRepository();
        repositories = { userRepository, projectRepository, privilegeRepository, sampleRepository };
        ecotaxa = new ExploreEcoTaxaService(new MockEcotaxaAccountRepository(), sampleRepository, projectRepository);
        particleBins = new ExploreParticleBins(sampleRepository);
        useCase = new GetExploreEcoTaxaGraphs(repositories, ecotaxa, particleBins);

        samples = [sample(1, 1), sample(2, 2), sample(3, 3), sample(4, 2)];
        answer = {
            in_ecotaxa: new Set([1, 3]),
            histograms: new Map([
                [1, histogram(1, [{ classif_id: 10, depth_bin: 0, nb_validated: 4, nb_predicted: 0 }, { classif_id: 11, depth_bin: 0, nb_validated: 2, nb_predicted: 6 }])],
                [3, histogram(3, [{ classif_id: 20, depth_bin: 0, nb_validated: 1, nb_predicted: 0 }])],
            ]),
            pending: 0,
            taxonOf: (_sample_id, classif_id) => TAXA[classif_id],
        };
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(userRepository, "isAdmin").mockResolvedValue(false);
        jest.spyOn(projectRepository, "listProjects").mockResolvedValue([OPEN, PRIVATE, VISIBLE]);
        jest.spyOn(privilegeRepository, "getPublicPrivilegesOfProjects").mockResolvedValue(new Map([[2, privileges(2, [ALICE])]]));
        jest.spyOn(sampleRepository, "countSamplesPerProject").mockResolvedValue(new Map());
        jest.spyOn(sampleRepository, "getExploreSamples").mockImplementation(async () => samples);
        jest.spyOn(ecotaxa, "histogramsOf").mockImplementation(async () => answer);
        jest.spyOn(particleBins, "binsOf").mockResolvedValue(BINS);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const histogramIds = () => ((ecotaxa.histogramsOf as jest.Mock).mock.calls[0][0] as ExploreSampleRow[]).map(row => row.sample_id);
    const volumeIds = () => (particleBins.binsOf as jest.Mock).mock.calls.map(call => call[0].sample_id);

    test("the depth profiles of projects whose figures the user may see: validated objects per legacy bin, # m-3", async () => {
        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(sampleRepository.getExploreSamples).toBeCalledWith(expect.objectContaining({ sample_type_label: "Depth" }));
        expect(histogramIds()).toEqual([1, 3]);
        // The water volume comes from the 5 m particle bins of the samples with objects.
        expect(particleBins.binsOf).toBeCalledWith(samples[0], expect.objectContaining({ project: OPEN, can_figures: true }), "depth", 5);
        expect(volumeIds()).toEqual([1, 3]);
        expect(graphs).toEqual({
            keys: ["Copepoda", "Calanoida", "detritus"],
            axis_labels: { Copepoda: "Copepoda # m-3", Calanoida: "Calanoida # m-3", detritus: "detritus # m-3" },
            series: {
                Copepoda: [{ sample_id: 1, sample_name: "moose_001", positions: [0, 5], values: [2000, 2000] }],
                Calanoida: [{ sample_id: 1, sample_name: "moose_001", positions: [0, 5], values: [1000, 1000] }],
                detritus: [{ sample_id: 3, sample_name: "moose_003", positions: [0, 5], values: [500, 500] }],
            },
            warnings: ["2 samples of private projects are not drawn"],
            nb_samples_pending: 0,
        });
    });

    test("include_predicted, sum_child_taxa and the living filter of the selection are applied", async () => {
        const graphs = await useCase.execute({ user_id: CAROL.user_id }, {
            mode: "depth", filters: exploreFilters({ ecotaxa_exclude_not_living: true }), include_predicted: true, sum_child_taxa: true,
        });

        expect(graphs.keys).toEqual(["Copepoda", "Calanoida"]);
        // Copepoda: 4 of its own and the 8 Calanoida, in 2 litres.
        expect(graphs.series.Copepoda[0].values).toEqual([6000, 6000]);
        expect(graphs.series.Calanoida[0].values).toEqual([4000, 4000]);
        expect(graphs.axis_labels.Copepoda).toBe("Copepoda and children # m-3");
    });

    test("an anonymous caller is served as a user without privilege", async () => {
        const graphs = await useCase.execute(null, { mode: "depth", filters: null });

        expect(histogramIds()).toEqual([1, 3]);
        expect(graphs.keys).toEqual(["Copepoda", "Calanoida", "detritus"]);
        expect(userRepository.ensureUserCanBeUsed).toBeCalledTimes(0);
    });

    test("a user who cannot be used gets no graph and EcoTaxa is not asked", async () => {
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));

        await expect(useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null })).rejects.toThrow("User cannot be used");
        expect(ecotaxa.histogramsOf).toBeCalledTimes(0);
    });

    test("says which samples are not in EcoTaxa and how many are still being read", async () => {
        samples = [sample(1, 1), sample(3, 3), sample(5, 1)];
        answer = { ...answer, pending: 2 };

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(graphs.warnings).toEqual([
            "1 of the 3 samples drawn is not imported in EcoTaxa",
            "The objects of 2 samples are being read from EcoTaxa: the curves complete in a moment",
        ]);
        expect(graphs.nb_samples_pending).toBe(2);
    });

    test("no sample in EcoTaxa: one warning, no particle file read", async () => {
        samples = [sample(1, 1), sample(3, 3)];
        answer = { ...answer, in_ecotaxa: new Set(), histograms: new Map() };

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(graphs.warnings).toEqual(["None of the 2 samples drawn is imported in EcoTaxa"]);
        expect(graphs.keys).toEqual([]);
        expect(particleBins.binsOf).toBeCalledTimes(0);
    });

    test("only predicted objects: an empty graph says to include them", async () => {
        samples = [sample(1, 1)];
        answer = { ...answer, in_ecotaxa: new Set([1]), histograms: new Map([[1, histogram(1, [{ classif_id: 10, depth_bin: 0, nb_validated: 0, nb_predicted: 7 }])]]) };

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(graphs.keys).toEqual([]);
        expect(graphs.warnings).toEqual(["The samples drawn have no validated object: include the predicted objects to draw them"]);
    });

    test("a sample without readable particle data has no curve, with its name", async () => {
        jest.spyOn(particleBins, "binsOf").mockImplementation(async (row) => {
            if (row.sample_id === 3) throw new Error("Sample moose_003 has no particle data");
            return BINS;
        });

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(graphs.keys).toEqual(["Copepoda", "Calanoida"]);
        expect(graphs.warnings).toContain("1 sample has no readable particle data, so no water volume: moose_003");
    });

    test(`at most ${EXPLORE_GRAPH_MAX_SAMPLES} samples are drawn`, async () => {
        samples = Array.from({ length: EXPLORE_GRAPH_MAX_SAMPLES + 5 }, (_, i) => sample(100 + i, 1));
        answer = { ...answer, in_ecotaxa: new Set(samples.map(row => row.sample_id)), histograms: new Map() };

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(histogramIds()).toHaveLength(EXPLORE_GRAPH_MAX_SAMPLES);
        expect(graphs.warnings).toEqual([`Only the first ${EXPLORE_GRAPH_MAX_SAMPLES} of the ${EXPLORE_GRAPH_MAX_SAMPLES + 5} samples are drawn: narrow the selection`]);
    });
});
