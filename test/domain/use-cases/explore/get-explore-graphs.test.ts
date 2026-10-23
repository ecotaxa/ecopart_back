import { CtdRows } from "../../../../src/domain/entities/ctd";
import { ExploreSampleRow } from "../../../../src/domain/entities/explore";
import { REDUCED_CLASS_COUNT } from "../../../../src/domain/constants/size-classes";
import { ExploreEcoTaxaService } from "../../../../src/domain/use-cases/explore/explore-ecotaxa";
import { EXPLORE_GRAPH_MAX_SAMPLES, ExploreParticleBins, ReducedBins } from "../../../../src/domain/use-cases/explore/explore-graphs";
import { ExploreSelectionRepositories } from "../../../../src/domain/use-cases/explore/explore-selection";
import { GetExploreGraphs } from "../../../../src/domain/use-cases/explore/get-explore-graphs";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { ALICE, CAROL, exploreFilters, exploreProject, exploreSample, privileges } from "./explore-fixtures";

const OPEN = exploreProject(1, "open", { project_title: "Ligurian profiles", enable_descent_filter: true });
const PRIVATE = exploreProject(2, "private", { project_title: "Arctic moorings" });
const VISIBLE = exploreProject(3, "visible", { project_title: "Tara Pacific" });

// Every sample sees the 64-128 µm class: one bin of 10 particles in 2 litres.
const BINS: ReducedBins = {
    positions: [2.5],
    volumes: [2],
    counts: [Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => k === 6 ? 10 : 0)],
    biovolumes_mm3: [Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => k === 6 ? 0.4 : 0)],
    visible: Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => k === 6),
};

// Down to 6 dbar, back up to 4 dbar: the descent filter drops the 30 °C row.
const YOYO: CtdRows = { columns: ["pressure [db]", "temperature [degc]"], values: [[1, 10], [6, 20], [4, 30]], time_ms: [null, null, null] };

const sample = (sample_id: number, project_id: number, overrides: Partial<ExploreSampleRow> = {}) =>
    exploreSample({ sample_id, project_id, sample_name: `moose_${String(sample_id).padStart(3, "0")}`, ...overrides });

describe("GetExploreGraphs", () => {
    let userRepository: MockUserRepository;
    let projectRepository: MockProjectRepository;
    let privilegeRepository: MockPrivilegeRepository;
    let sampleRepository: MockSampleRepository;
    let repositories: ExploreSelectionRepositories;
    let ecotaxa: ExploreEcoTaxaService;
    let particleBins: ExploreParticleBins;
    let useCase: GetExploreGraphs;
    let samples: ExploreSampleRow[];

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
        useCase = new GetExploreGraphs(repositories, ecotaxa, particleBins);

        samples = [sample(1, 1), sample(2, 2), sample(3, 3), sample(4, 2)];
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(userRepository, "isAdmin").mockResolvedValue(false);
        jest.spyOn(projectRepository, "listProjects").mockResolvedValue([OPEN, PRIVATE, VISIBLE]);
        jest.spyOn(privilegeRepository, "getPublicPrivilegesOfProjects").mockResolvedValue(new Map([[2, privileges(2, [ALICE])]]));
        jest.spyOn(sampleRepository, "countSamplesPerProject").mockResolvedValue(new Map());
        jest.spyOn(sampleRepository, "getExploreSamples").mockImplementation(async () => samples);
        jest.spyOn(sampleRepository, "getCtdRows").mockResolvedValue(YOYO);
        jest.spyOn(particleBins, "binsOf").mockResolvedValue(BINS);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const drawnIds = () => (particleBins.binsOf as jest.Mock).mock.calls.map(call => call[0].sample_id);

    test("an anonymous caller must log in, before anything is read", async () => {
        await expect(useCase.execute(null, { mode: "depth", filters: null })).rejects.toThrow("Login required");
        expect(projectRepository.listProjects).toBeCalledTimes(0);
        expect(particleBins.binsOf).toBeCalledTimes(0);
    });

    test("a step out of bounds is refused before the selection is resolved", async () => {
        await expect(useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null, pressure_bin: 0 })).rejects.toThrow("pressure_bin must be between 1 and 100");
        await expect(useCase.execute({ user_id: CAROL.user_id }, { mode: "time", filters: null, time_bin: 48 })).rejects.toThrow("time_bin must be between 0.5 and 24");
        expect(userRepository.ensureUserCanBeUsed).toBeCalledTimes(0);
        expect(projectRepository.listProjects).toBeCalledTimes(0);
    });

    test("a user who cannot be used gets no graph", async () => {
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));

        await expect(useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null })).rejects.toThrow("User cannot be used");
        expect(particleBins.binsOf).toBeCalledTimes(0);
    });

    test("leaves out the samples of projects whose figures the user may not see, with a warning", async () => {
        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null, pressure_bin: 10 });

        expect(drawnIds()).toEqual([1, 3]);
        expect(particleBins.binsOf).toBeCalledWith(samples[0], expect.objectContaining({ project: OPEN, can_figures: true }), "depth", 10);
        expect(graphs.warnings).toEqual(["2 samples of private projects are not drawn"]);
        expect(graphs.abundance.keys).toEqual(["64-128 µm"]);
        expect(graphs.abundance.series["64-128 µm"].map(series => series.sample_id)).toEqual([1, 3]);
        expect(graphs.abundance.series["64-128 µm"][0].points).toEqual([{ position: 2.5, value: 5 }]);
        expect(graphs.biovolume.series["64-128 µm"][0].points).toEqual([{ position: 2.5, value: 0.2 }]);
        expect(graphs.ecotaxa).toEqual({ keys: [], axis_labels: {}, series: {} });
    });

    test("one hidden sample: singular warning; a manager of the private project sees everything", async () => {
        samples = [sample(1, 1), sample(2, 2)];
        const carol = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });
        expect(carol.warnings).toEqual(["1 sample of private projects is not drawn"]);

        (particleBins.binsOf as jest.Mock).mockClear();
        const alice = await useCase.execute({ user_id: ALICE.user_id }, { mode: "depth", filters: null });
        expect(alice.warnings).toEqual([]);
        expect(drawnIds()).toEqual([1, 2]);
    });

    test("depth profiles use the pressure step (default 5 m), time series the time step (default 1 h)", async () => {
        samples = [sample(1, 1)];
        await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });
        await useCase.execute({ user_id: CAROL.user_id }, { mode: "time", filters: null });
        await useCase.execute({ user_id: CAROL.user_id }, { mode: "time", filters: null, pressure_bin: 20, time_bin: 6 });

        expect((particleBins.binsOf as jest.Mock).mock.calls.map(call => [call[2], call[3]])).toEqual([["depth", 5], ["time", 1], ["time", 6]]);
        expect(sampleRepository.getExploreSamples).toHaveBeenLastCalledWith(expect.objectContaining({ sample_type_label: "Time" }));
    });

    test(`draws at most ${EXPLORE_GRAPH_MAX_SAMPLES} samples, the first ones`, async () => {
        samples = Array.from({ length: EXPLORE_GRAPH_MAX_SAMPLES + 1 }, (_, i) => sample(i + 1, 1));

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(particleBins.binsOf).toBeCalledTimes(EXPLORE_GRAPH_MAX_SAMPLES);
        expect(drawnIds()).not.toContain(EXPLORE_GRAPH_MAX_SAMPLES + 1);
        expect(graphs.warnings).toEqual([`Only the first ${EXPLORE_GRAPH_MAX_SAMPLES} of the ${EXPLORE_GRAPH_MAX_SAMPLES + 1} samples are drawn: narrow the selection`]);
        expect(graphs.abundance.series["64-128 µm"]).toHaveLength(EXPLORE_GRAPH_MAX_SAMPLES);
    });

    test("a sample whose particles cannot be read is a warning, not an error", async () => {
        samples = [sample(1, 1), sample(2, 1), sample(3, 1)];
        jest.spyOn(particleBins, "binsOf").mockImplementation(async (row) => {
            if (row.sample_id === 2) throw new Error("Sample moose_002 has no particle data");
            return BINS;
        });

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(graphs.warnings).toEqual(["1 sample without readable particle data: moose_002"]);
        expect(graphs.abundance.series["64-128 µm"].map(series => series.sample_id)).toEqual([1, 3]);
    });

    test("many failures are named five at a time", async () => {
        samples = Array.from({ length: 7 }, (_, i) => sample(i + 1, 1));
        jest.spyOn(particleBins, "binsOf").mockRejectedValue(new Error("ENOENT"));

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(graphs.warnings).toEqual(["7 samples without readable particle data: moose_001, moose_002, moose_003, moose_004, moose_005 and 2 more"]);
        expect(graphs.abundance).toEqual({ keys: [], axis_labels: {}, series: {} });
    });

    test("reads the CTD of the drawn samples that have one, with the project's descent filter on depth profiles", async () => {
        samples = [sample(1, 1, { ctd_imported: true, ctd_file_extension: "ctd" }), sample(3, 3, { ctd_imported: true, ctd_file_extension: null }), sample(5, 3)];

        const depth = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(sampleRepository.getCtdRows).toBeCalledTimes(1);
        expect(sampleRepository.getCtdRows).toBeCalledWith(1, "moose_001", "ctd");
        expect(depth.ctd.keys).toEqual(["temperature"]);
        // The project enables the descent filter: the row at 4 dbar after 6 dbar is dropped.
        expect(depth.ctd.series.temperature).toEqual([{ sample_id: 1, sample_name: "moose_001", points: [{ position: 2.5, value: 10 }, { position: 7.5, value: 20 }] }]);
    });

    test("without the project's descent filter every CTD row counts", async () => {
        jest.spyOn(projectRepository, "listProjects").mockResolvedValue([{ ...OPEN, enable_descent_filter: false }, PRIVATE, VISIBLE]);
        samples = [sample(1, 1, { ctd_imported: true, ctd_file_extension: "ctd" })];

        const depth = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(depth.ctd.series.temperature[0].points).toEqual([{ position: 2.5, value: 20 }, { position: 7.5, value: 20 }]);
    });

    test("a CTD file that cannot be read is a warning", async () => {
        samples = [sample(1, 1, { ctd_imported: true, ctd_file_extension: "ctd" }), sample(2, 1, { ctd_imported: true, ctd_file_extension: "txt" })];
        jest.spyOn(sampleRepository, "getCtdRows").mockImplementation(async (...args: unknown[]) => {
            if (args[1] === "moose_002") throw new Error("ENOENT");
            return YOYO;
        });

        const graphs = await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

        expect(graphs.warnings).toEqual(["1 CTD file could not be read: moose_002"]);
        expect(graphs.ctd.series.temperature.map(series => series.sample_id)).toEqual([1]);
    });

    test("the classification state is decided with EcoTaxa before drawing", async () => {
        jest.spyOn(ecotaxa, "filterByClassificationState").mockImplementation(async (rows) => rows.filter(row => row.sample_id === 3));
        const filters = exploreFilters({ classification_state: "fully_validated" });

        await useCase.execute({ user_id: CAROL.user_id }, { mode: "depth", filters });

        expect(ecotaxa.filterByClassificationState).toBeCalledWith(samples, expect.any(Map), filters);
        expect(drawnIds()).toEqual([3]);
    });
});
