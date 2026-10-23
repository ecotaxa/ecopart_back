import { EcotaxaAccountResponseModel, EcotaxaInstanceModel, EcoTaxaObjectSetQuery, EcoTaxaTaxon } from "../../../../src/domain/entities/ecotaxa_account";
import { EcoTaxaImportedSample, ExploreSampleRow, StoredEcoTaxaStats } from "../../../../src/domain/entities/explore";
import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { EcoTaxaThrottle } from "../../../../src/domain/use-cases/explore/ecotaxa-throttle";
import {
    classificationSharesOf,
    ECOTAXA_CACHE_TTL_MS,
    ECOTAXA_MAX_IN_FLIGHT,
    ECOTAXA_QUEUE_PAUSE_MS,
    ECOTAXA_STATS_BATCH,
    ECOTAXA_STATS_STALE_AFTER_MS,
    ECOTAXA_SYNC_REFRESH_LIMIT,
    EcoTaxaSampleStat,
    ExploreEcoTaxaService,
    matchesClassificationState,
    objectDate,
    toSampleStat,
} from "../../../../src/domain/use-cases/explore/explore-ecotaxa";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { contextsOf, exploreContext, exploreFilters, exploreProject, exploreSample } from "./explore-fixtures";

const stat = (counts: Partial<Omit<EcoTaxaSampleStat, "ecotaxa_sample_id" | "used_taxa">>, used_taxa: number[] = [], ecotaxa_sample_id = 1): EcoTaxaSampleStat => ({
    ecotaxa_sample_id, used_taxa, nb_unclassified: 0, nb_validated: 0, nb_dubious: 0, nb_predicted: 0, ...counts,
});

describe("matchesClassificationState", () => {
    test("'all' matches anything, even a sample without object", () => {
        expect(matchesClassificationState(stat({}), "all")).toBe(true);
        expect(matchesClassificationState(stat({ nb_unclassified: 4 }), "all")).toBe(true);
    });

    test("a sample without object matches no other state", () => {
        expect(matchesClassificationState(stat({}), "fully_validated")).toBe(false);
        expect(matchesClassificationState(stat({}), "fully_predicted")).toBe(false);
    });

    test("fully validated / predicted: every object, dubious and unclassified ones included in the total", () => {
        expect(matchesClassificationState(stat({ nb_validated: 120 }), "fully_validated")).toBe(true);
        expect(matchesClassificationState(stat({ nb_validated: 119, nb_dubious: 1 }), "fully_validated")).toBe(false);
        expect(matchesClassificationState(stat({ nb_predicted: 80 }), "fully_predicted")).toBe(true);
        expect(matchesClassificationState(stat({ nb_predicted: 79, nb_unclassified: 1 }), "fully_predicted")).toBe(false);
        expect(matchesClassificationState(stat({ nb_validated: 10, nb_predicted: 10 }), "fully_predicted")).toBe(false);
    });
});

describe("classificationSharesOf", () => {
    test("exclusive states in percent of the samples with objects", () => {
        expect(classificationSharesOf([
            stat({ nb_validated: 50 }),                       // fully validated
            stat({ nb_validated: 3, nb_predicted: 7 }),       // partially validated
            stat({ nb_predicted: 40 }),                       // fully predicted
            stat({ nb_predicted: 5, nb_unclassified: 5 }),    // partially predicted
            stat({}),                                         // no object: not counted
        ])).toEqual({ fully_validated: 25, fully_predicted: 25, partially_validated: 25, partially_predicted: 25 });
    });

    test("rounded to one decimal; a sample with only dubious objects is counted in no state", () => {
        expect(classificationSharesOf([stat({ nb_validated: 1 }), stat({ nb_predicted: 1 }), stat({ nb_dubious: 4 })]))
            .toEqual({ fully_validated: 33.3, fully_predicted: 33.3, partially_validated: 0, partially_predicted: 0 });
        expect(classificationSharesOf([stat({ nb_validated: 1 }), stat({ nb_validated: 1 }), stat({ nb_predicted: 2 })]))
            .toEqual({ fully_validated: 66.7, fully_predicted: 33.3, partially_validated: 0, partially_predicted: 0 });
    });

    test("no stats: zeros", () => {
        expect(classificationSharesOf([])).toEqual({ fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 });
        expect(classificationSharesOf([stat({})])).toEqual({ fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 });
    });
});

describe("objectDate", () => {
    test("EcoTaxa objdate and objtime to an ISO date, midnight without a time", () => {
        expect(objectDate("2024-06-12", "10:20:30")).toBe("2024-06-12T10:20:30.000Z");
        expect(objectDate("2024-06-12", null)).toBe("2024-06-12T00:00:00.000Z");
        expect(objectDate("2024-06-12", "")).toBe("2024-06-12T00:00:00.000Z");
    });

    test("null when the date is missing or unreadable", () => {
        expect(objectDate(null, "10:20:30")).toBeNull();
        expect(objectDate("", "10:20:30")).toBeNull();
        expect(objectDate(20240612, "10:20:30")).toBeNull();
        expect(objectDate("12/06/2024", "10:20:30")).toBeNull();
    });
});

describe("toSampleStat", () => {
    test("drops what only the database knows (sample id, date of the read)", () => {
        expect(toSampleStat({ sample_id: 7, ecotaxa_sample_id: 9007, nb_unclassified: 1, nb_validated: 2, nb_dubious: 3, nb_predicted: 4, used_taxa: [10, 20], fetched_utc_date_time: "2026-10-22T08:00:00.000Z" }))
            .toEqual({ ecotaxa_sample_id: 9007, used_taxa: [10, 20], nb_unclassified: 1, nb_validated: 2, nb_dubious: 3, nb_predicted: 4 });
    });
});

/* ─── the service ─── */

const INSTANCES: Record<number, EcotaxaInstanceModel> = {
    1: { ecotaxa_instance_id: 1, ecotaxa_instance_name: "FR", ecotaxa_instance_description: "EcoTaxa Villefranche", ecotaxa_instance_creation_utc_date_time: "2024-01-01 00:00:00", ecotaxa_instance_url: "https://ecotaxa.obs-vlfr.fr/" },
    2: { ecotaxa_instance_id: 2, ecotaxa_instance_name: "DEV", ecotaxa_instance_description: "EcoTaxa dev", ecotaxa_instance_creation_utc_date_time: "2024-01-01 00:00:00", ecotaxa_instance_url: "https://ecotaxa.dev.example.org/" },
};
const TOKEN: Record<number, string> = { 1: "generic-token-fr", 2: "generic-token-dev" };

function genericAccount(instance_id: number): EcotaxaAccountResponseModel {
    return {
        ecotaxa_account_id: 100 + instance_id,
        ecotaxa_account_ecotaxa_id: 9,
        ecotaxa_account_ecopart_user_id: 1,
        ecotaxa_account_token: TOKEN[instance_id],
        ecotaxa_account_user_name: "ecopart generic",
        ecotaxa_account_user_email: "ecopart@imev-mer.fr",
        ecotaxa_account_instance_id: instance_id,
        ecotaxa_account_expiration_utc_date_time: "2030-01-01 00:00:00",
        ecotaxa_account_creation_utc_date_time: "2024-01-01 00:00:00",
        ecotaxa_account_instance_name: INSTANCES[instance_id].ecotaxa_instance_name,
    };
}

const ON_FR = exploreProject(1, "open", { ecotaxa_project_id: 1450, ecotaxa_instance_id: 1, ecotaxa_project_name: "UVP6 Ligurian" });
const ON_DEV = exploreProject(2, "open", { ecotaxa_project_id: 77, ecotaxa_instance_id: 2 });
const WITHOUT_ECOTAXA = exploreProject(3, "open");
const PROJECTS = contextsOf(exploreContext(ON_FR), exploreContext(ON_DEV), exploreContext(WITHOUT_ECOTAXA));

const imported = (sample_id: number, project_id: number, ecotaxa_sample_id: number | null, overrides: Partial<ExploreSampleRow> = {}) =>
    exploreSample({ sample_id, project_id, sample_name: `moose_ge_2024_${String(sample_id).padStart(3, "0")}`, ecotaxa_sample_imported: true, ecotaxa_sample_id, ...overrides });

type StatRow = { sample_id: number; used_taxa: number[]; nb_unclassified: number; nb_validated: number; nb_dubious: number; nb_predicted: number; projid: number };
const statRow = (sample_id: number, counts: Partial<StatRow> = {}): StatRow => ({ sample_id, used_taxa: [], nb_unclassified: 0, nb_validated: 10, nb_dubious: 0, nb_predicted: 0, projid: 1450, ...counts });

const TAXA: Record<number, EcoTaxaTaxon> = {
    10: { id: 10, name: "Copepoda", display_name: "Copepoda", id_lineage: [10, 85, 1], nb_objects: 1200 },
    20: { id: 20, name: "detritus", display_name: "detritus", id_lineage: [20, 84963], nb_objects: 5400 },
    30: { id: 30, name: "Appendicularia", display_name: "Appendicularia", id_lineage: [30, 92, 1], nb_objects: 300 },
    40: { id: 40, name: "Rhizaria", display_name: "Rhizaria", id_lineage: [40, 1], nb_objects: 12 },
};

const DAY = ECOTAXA_STATS_STALE_AFTER_MS;

// What EcoPart keeps for a sample, read from EcoTaxa at `fetched_ms`.
const storedRow = (sample_id: number, ecotaxa_sample_id: number, fetched_ms: number, counts: Partial<StoredEcoTaxaStats> = {}): StoredEcoTaxaStats => ({
    sample_id, ecotaxa_sample_id, nb_unclassified: 0, nb_validated: 10, nb_dubious: 0, nb_predicted: 0, used_taxa: [], fetched_utc_date_time: new Date(fetched_ms).toISOString(), ...counts,
});

const importedRow = (sample_id: number, project_id: number, ecotaxa_sample_id: number | null): EcoTaxaImportedSample =>
    ({ sample_id, project_id, sample_name: `moose_ge_2024_${String(sample_id).padStart(3, "0")}`, ecotaxa_sample_id });

// `count` samples of a project, numbered from `first_id`, EcoTaxa ids from `first_ecotaxa_id`.
const manySamples = (count: number, project_id: number, first_id: number, first_ecotaxa_id: number) =>
    Array.from({ length: count }, (_, i) => imported(first_id + i, project_id, first_ecotaxa_id + i));

// A pause that holds the queue until it is opened; `reached` once the queue waits on it.
function gate() {
    let open!: () => void;
    const opened = new Promise<void>(resolve => { open = resolve; });
    let reach!: () => void;
    const reached = new Promise<void>(resolve => { reach = resolve; });
    const pause = jest.fn(async (_ms: number) => { reach(); await opened; });
    return { pause, open, reached };
}

describe("ExploreEcoTaxaService", () => {
    let ecotaxaAccountRepository: EcotaxaAccountRepository;
    let sampleRepository: SampleRepository;
    let projectRepository: ProjectRepository;
    let clock: number;
    let randoms: number[];
    let throttle: EcoTaxaThrottle;
    let pause: jest.Mock<Promise<void>, [number]>;
    let service: ExploreEcoTaxaService;
    // What EcoTaxa answers, by EcoTaxa sample id.
    let statRows: Map<number, StatRow>;
    // What EcoPart keeps (table sample_ecotaxa_stats), by sample id.
    let stored: Map<number, StoredEcoTaxaStats>;
    // The samples imported in EcoTaxa, as the sweep lists them.
    let importedSamples: EcoTaxaImportedSample[];

    const makeService = (options: { pause?: (ms: number) => Promise<void> } = {}) => new ExploreEcoTaxaService(
        ecotaxaAccountRepository, sampleRepository, projectRepository,
        () => clock, () => randoms.length > 0 ? randoms.shift() as number : 0,
        throttle, options.pause ?? pause,
    );
    const statsCalls = () => (ecotaxaAccountRepository.api_ecotaxa_get_sample_stats as jest.Mock).mock.calls as [string, string, number[]][];
    const batchSizes = () => statsCalls().map(call => call[2].length);
    const ecotaxaCalls = () => ["api_ecotaxa_get_sample_stats", "api_ecotaxa_get_taxa", "api_ecotaxa_get_samples_in_project", "api_ecotaxa_query_object_set"]
        .reduce((sum, name) => sum + ((ecotaxaAccountRepository as unknown as Record<string, jest.Mock>)[name].mock?.calls.length ?? 0), 0);

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        ecotaxaAccountRepository = new MockEcotaxaAccountRepository();
        sampleRepository = new MockSampleRepository();
        projectRepository = new MockProjectRepository();
        clock = Date.UTC(2026, 9, 22, 8, 0, 0);
        randoms = [];
        throttle = new EcoTaxaThrottle(ECOTAXA_MAX_IN_FLIGHT);
        pause = jest.fn(async (_ms: number) => undefined);
        service = makeService();
        statRows = new Map();
        stored = new Map();
        importedSamples = [];

        jest.spyOn(ecotaxaAccountRepository, "getOneEcoTaxaInstance").mockImplementation(async (id) => INSTANCES[id] ?? null);
        jest.spyOn(ecotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockImplementation(async (id) => genericAccount(id));
        jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockImplementation(async (_url, _token, ids) =>
            ids.map(id => statRows.get(id) ?? statRow(id)));
        jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_taxa").mockImplementation(async (_url, _token, ids) => ids.map(id => TAXA[id]).filter(Boolean));
        jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_samples_in_project").mockResolvedValue([]);
        jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_query_object_set").mockResolvedValue({ total_ids: 0, object_ids: [], details: [] });
        jest.spyOn(sampleRepository, "standardUpdateManySamples").mockResolvedValue(1);
        jest.spyOn(sampleRepository, "getEcoTaxaStats").mockImplementation(async (sample_ids) =>
            sample_ids.flatMap(id => { const row = stored.get(id); return row ? [{ ...row, used_taxa: [...row.used_taxa] }] : []; }));
        jest.spyOn(sampleRepository, "saveEcoTaxaStats").mockImplementation(async (rows) => { for (const row of rows) stored.set(row.sample_id, { ...row }); });
        jest.spyOn(sampleRepository, "listEcoTaxaImportedSamples").mockImplementation(async () =>
            importedSamples.map(sample => ({ ...sample, fetched_utc_date_time: stored.get(sample.sample_id)?.fetched_utc_date_time ?? null })));
        jest.spyOn(projectRepository, "listProjects").mockResolvedValue([ON_FR, ON_DEV, WITHOUT_ECOTAXA]);
    });

    afterEach(async () => {
        await service.idle();
        jest.restoreAllMocks();
    });

    describe("statsOf", () => {
        test("asks each instance through its generic account, only for the samples imported in EcoTaxa, and keeps the answers", async () => {
            const samples = [
                imported(1, 1, 9001),
                imported(2, 2, 501),
                exploreSample({ sample_id: 3, project_id: 1, ecotaxa_sample_imported: false, ecotaxa_sample_id: 9003 }),
                imported(4, 3, 9004),
                imported(5, 1, 9005),
            ];
            statRows.set(9001, statRow(9001, { nb_validated: 3, nb_predicted: 7, used_taxa: [10] }));

            const stats = await service.statsOf(samples, PROJECTS);

            expect(Array.from(stats.keys()).sort()).toEqual([1, 2, 5]);
            expect(stats.get(1)).toEqual({ ecotaxa_sample_id: 9001, used_taxa: [10], nb_unclassified: 0, nb_validated: 3, nb_dubious: 0, nb_predicted: 7 });
            expect(sampleRepository.getEcoTaxaStats).toBeCalledWith([1, 2, 5]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(2);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [9001, 9005]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.dev.example.org/", "generic-token-dev", [501]);
            // One lookup per instance, whatever the number of its samples.
            expect(ecotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledTimes(2);
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledTimes(2);
            expect(ecotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledWith(1);
            expect(ecotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledWith(2);
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledWith(1);
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledWith(2);
            // The answers are saved, one save per EcoTaxa call, dated now.
            const fetched_utc_date_time = new Date(clock).toISOString();
            expect(sampleRepository.saveEcoTaxaStats).toBeCalledTimes(2);
            expect(sampleRepository.saveEcoTaxaStats).toBeCalledWith([
                { sample_id: 1, ecotaxa_sample_id: 9001, used_taxa: [10], nb_unclassified: 0, nb_validated: 3, nb_dubious: 0, nb_predicted: 7, fetched_utc_date_time },
                { sample_id: 5, ecotaxa_sample_id: 9005, used_taxa: [], nb_unclassified: 0, nb_validated: 10, nb_dubious: 0, nb_predicted: 0, fetched_utc_date_time },
            ]);
            expect(sampleRepository.saveEcoTaxaStats).toBeCalledWith([
                { sample_id: 2, ecotaxa_sample_id: 501, used_taxa: [], nb_unclassified: 0, nb_validated: 10, nb_dubious: 0, nb_predicted: 0, fetched_utc_date_time },
            ]);
            expect(Array.from(stored.keys()).sort()).toEqual([1, 2, 5]);
        });

        test("a missing used_taxa list is an empty one, saved as such", async () => {
            statRows.set(9001, { ...statRow(9001), used_taxa: null as unknown as number[] });

            const stats = await service.statsOf([imported(1, 1, 9001)], PROJECTS);

            expect(stats.get(1)?.used_taxa).toEqual([]);
            expect(stored.get(1)?.used_taxa).toEqual([]);
        });

        test("a row EcoTaxa returns for a sample it was not asked is ignored", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockResolvedValue([statRow(9001), statRow(4242)]);

            const stats = await service.statsOf([imported(1, 1, 9001)], PROJECTS);

            expect(Array.from(stats.keys())).toEqual([1]);
            expect(Array.from(stored.keys())).toEqual([1]);
        });

        test("resolves the EcoTaxa ids EcoPart never stored by sample name, and writes them back", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_samples_in_project").mockResolvedValue([
                { sampleid: 9007, orig_id: "moose_ge_2024_007" },
                { sampleid: 9999, orig_id: "another_sample" },
            ]);
            const resolvable = imported(7, 1, null);
            const unknown = imported(8, 1, null);

            const stats = await service.statsOf([resolvable, unknown], PROJECTS);

            expect(ecotaxaAccountRepository.api_ecotaxa_get_samples_in_project).toBeCalledTimes(1);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_samples_in_project).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", 1450);
            expect(sampleRepository.standardUpdateManySamples).toBeCalledTimes(1);
            expect(sampleRepository.standardUpdateManySamples).toBeCalledWith({ ecotaxa_sample_id: 9007 }, { sample_id: 7 });
            expect(resolvable.ecotaxa_sample_id).toBe(9007);
            expect(unknown.ecotaxa_sample_id).toBeNull();
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [9007]);
            expect(Array.from(stats.keys())).toEqual([7]);
            expect(stored.get(7)?.ecotaxa_sample_id).toBe(9007);
        });

        test(`the ids of a project are not looked up again within ${ECOTAXA_CACHE_TTL_MS} ms`, async () => {
            await service.statsOf([imported(8, 1, null)], PROJECTS);
            clock += ECOTAXA_CACHE_TTL_MS - 1;
            await service.statsOf([imported(8, 1, null)], PROJECTS);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_samples_in_project).toBeCalledTimes(1);

            clock += 1;
            await service.statsOf([imported(8, 1, null)], PROJECTS);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_samples_in_project).toBeCalledTimes(2);
            expect(sampleRepository.standardUpdateManySamples).toBeCalledTimes(0);
        });

        test("ids that cannot be resolved are left out without writing anything", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_samples_in_project").mockRejectedValue(new Error("EcoTaxa answered 503"));

            const stats = await service.statsOf([imported(7, 1, null), imported(1, 1, 9001)], PROJECTS);

            expect(sampleRepository.standardUpdateManySamples).toBeCalledTimes(0);
            expect(Array.from(stats.keys())).toEqual([1]);
        });

        test(`keeps the access to an instance for ${ECOTAXA_CACHE_TTL_MS} ms`, async () => {
            await service.statsOf([imported(1, 1, 9001)], PROJECTS);
            clock += ECOTAXA_CACHE_TTL_MS - 1;
            await service.statsOf([imported(1, 1, 9001)], PROJECTS);
            expect(ecotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledTimes(1);
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledTimes(1);

            clock += 1;
            await service.statsOf([imported(1, 1, 9001)], PROJECTS);
            expect(ecotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledTimes(2);
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledTimes(2);
        });

        test("an instance that does not answer is skipped, the others are served; it is asked again later", async () => {
            jest.spyOn(ecotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockImplementation(async (id) => {
                if (id === 2) throw new Error("No generic account for instance 2");
                return genericAccount(id);
            });
            const samples = () => [imported(1, 1, 9001), imported(2, 2, 501), imported(3, 2, 502)];

            const stats = await service.statsOf(samples(), PROJECTS);

            expect(Array.from(stats.keys())).toEqual([1]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(1);
            // The failure is remembered: the instance is not asked again for sample 3.
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledTimes(2);

            // The instance is back, but its failure is kept for a while.
            jest.spyOn(ecotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockImplementation(async (id) => genericAccount(id));
            const meanwhile = await service.statsOf(samples(), PROJECTS);
            expect(Array.from(meanwhile.keys())).toEqual([1]);
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledTimes(2);

            clock += ECOTAXA_CACHE_TTL_MS;
            const later = await service.statsOf(samples(), PROJECTS);
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledTimes(4);
            expect(Array.from(later.keys()).sort()).toEqual([1, 2, 3]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toHaveBeenLastCalledWith("https://ecotaxa.dev.example.org/", "generic-token-dev", [501, 502]);
        });

        test("an unknown instance is skipped", async () => {
            jest.spyOn(ecotaxaAccountRepository, "getOneEcoTaxaInstance").mockResolvedValue(null);

            await expect(service.statsOf([imported(1, 1, 9001)], PROJECTS)).resolves.toEqual(new Map());
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(0);
        });

        test("a failing stats call leaves the samples of that instance out, without exception, and saves the others", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockImplementation(async (url, _token, ids) => {
                if (url === "https://ecotaxa.dev.example.org/") throw new Error("timeout");
                return ids.map(id => statRow(id));
            });

            const stats = await service.statsOf([imported(1, 1, 9001), imported(2, 2, 501)], PROJECTS);

            expect(Array.from(stats.keys())).toEqual([1]);
            expect(sampleRepository.saveEcoTaxaStats).toBeCalledTimes(1);
            expect(Array.from(stored.keys())).toEqual([1]);
            expect(console.log).toBeCalledWith(expect.any(String), "Explore: EcoTaxa sample stats unavailable on instance 2", "timeout");
        });
    });

    describe("stored stats", () => {
        test("stats read less than a day ago, for the same EcoTaxa sample, are served without asking EcoTaxa", async () => {
            stored.set(1, storedRow(1, 9001, clock - DAY + 1, { nb_validated: 3, nb_predicted: 7, used_taxa: [10, 20] }));
            stored.set(2, storedRow(2, 501, clock - 60 * 60 * 1000, { nb_validated: 0, nb_predicted: 12 }));

            const stats = await service.statsOf([imported(1, 1, 9001), imported(2, 2, 501)], PROJECTS);

            expect(stats).toEqual(new Map([
                [1, { ecotaxa_sample_id: 9001, used_taxa: [10, 20], nb_unclassified: 0, nb_validated: 3, nb_dubious: 0, nb_predicted: 7 }],
                [2, { ecotaxa_sample_id: 501, used_taxa: [], nb_unclassified: 0, nb_validated: 0, nb_dubious: 0, nb_predicted: 12 }],
            ]));
            expect(sampleRepository.getEcoTaxaStats).toBeCalledWith([1, 2]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(0);
            expect(sampleRepository.saveEcoTaxaStats).toBeCalledTimes(0);
            expect(service.queued).toBe(0);
        });

        test("stats a day old or more are read again from EcoTaxa and saved with the time of the refresh", async () => {
            stored.set(1, storedRow(1, 9001, clock - DAY, { nb_validated: 10 }));
            stored.set(5, storedRow(5, 9005, clock - DAY + 1, { nb_validated: 10 }));
            statRows.set(9001, statRow(9001, { nb_validated: 3, nb_predicted: 7, used_taxa: [10] }));

            const stats = await service.statsOf([imported(1, 1, 9001), imported(5, 1, 9005)], PROJECTS);

            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(1);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [9001]);
            expect(stats.get(1)).toEqual({ ecotaxa_sample_id: 9001, used_taxa: [10], nb_unclassified: 0, nb_validated: 3, nb_dubious: 0, nb_predicted: 7 });
            expect(stats.get(5)?.nb_validated).toBe(10);
            expect(sampleRepository.saveEcoTaxaStats).toBeCalledWith([
                { sample_id: 1, ecotaxa_sample_id: 9001, used_taxa: [10], nb_unclassified: 0, nb_validated: 3, nb_dubious: 0, nb_predicted: 7, fetched_utc_date_time: new Date(clock).toISOString() },
            ]);
            expect(stored.get(5)?.fetched_utc_date_time).toBe(new Date(clock - DAY + 1).toISOString());
        });

        test("a sample now linked to another EcoTaxa sample is read again, whatever the age of its stats", async () => {
            stored.set(1, storedRow(1, 8888, clock - 60 * 1000, { nb_validated: 10 }));
            statRows.set(9001, statRow(9001, { nb_validated: 0, nb_predicted: 4 }));

            const stats = await service.statsOf([imported(1, 1, 9001)], PROJECTS);

            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [9001]);
            expect(stats.get(1)).toMatchObject({ ecotaxa_sample_id: 9001, nb_predicted: 4, nb_validated: 0 });
            expect(stored.get(1)).toMatchObject({ ecotaxa_sample_id: 9001, nb_predicted: 4, fetched_utc_date_time: new Date(clock).toISOString() });
        });

        test("what was read stays fresh for a day, then is read again", async () => {
            const samples = () => [imported(1, 1, 9001), imported(2, 2, 501)];

            const first = await service.statsOf(samples(), PROJECTS);
            clock += DAY - 1;
            const second = await service.statsOf(samples(), PROJECTS);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(2);
            expect(second).toEqual(first);

            clock += 1;
            await service.statsOf(samples(), PROJECTS);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(4);
            expect(stored.get(1)?.fetched_utc_date_time).toBe(new Date(clock).toISOString());
        });

        test("when EcoTaxa cannot refresh them, the stale stats are still served", async () => {
            stored.set(1, storedRow(1, 9001, clock - 3 * DAY, { nb_validated: 10 }));
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockRejectedValue(new Error("EcoTaxa answered 502"));

            const stats = await service.statsOf([imported(1, 1, 9001)], PROJECTS);

            expect(stats.get(1)?.nb_validated).toBe(10);
            expect(sampleRepository.saveEcoTaxaStats).toBeCalledTimes(0);
            expect(stored.get(1)?.fetched_utc_date_time).toBe(new Date(clock - 3 * DAY).toISOString());
        });
    });

    describe(`refresh: at most ${ECOTAXA_SYNC_REFRESH_LIMIT} samples at once, in batches of ${ECOTAXA_STATS_BATCH}, the rest in the background`, () => {
        test(`${ECOTAXA_SYNC_REFRESH_LIMIT} samples to refresh are read at once, in batches of ${ECOTAXA_STATS_BATCH}`, async () => {
            const samples = manySamples(ECOTAXA_SYNC_REFRESH_LIMIT, 1, 1, 10001);

            const summary = await service.summaryOf(samples, PROJECTS, false);

            expect(batchSizes()).toEqual([50, 50]);
            expect(summary.partial).toBe(false);
            expect(summary.nb_samples_pending).toBe(0);
            expect(summary.nb_samples_with_stats).toBe(ECOTAXA_SYNC_REFRESH_LIMIT);
            expect(service.queued).toBe(0);
            expect(pause).toBeCalledTimes(0);
            expect(stored.size).toBe(ECOTAXA_SYNC_REFRESH_LIMIT);
        });

        test("the samples of each instance go to their own instance", async () => {
            const samples = [...manySamples(60, 1, 1, 10001), ...manySamples(30, 2, 61, 20001)];

            await service.statsOf(samples, PROJECTS);

            const calls = statsCalls().map(([url, token, ids]) => [url, token, ids.length, Math.min(...ids), Math.max(...ids)]);
            expect(calls).toEqual([
                ["https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", 50, 10001, 10050],
                ["https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", 10, 10051, 10060],
                ["https://ecotaxa.dev.example.org/", "generic-token-dev", 30, 20001, 20030],
            ]);
            expect(stored.size).toBe(90);
        });

        test(`one sample more than ${ECOTAXA_SYNC_REFRESH_LIMIT}: nothing is read at once, everything is queued`, async () => {
            const { pause: held, open, reached } = gate();
            service = makeService({ pause: held });
            const samples = manySamples(ECOTAXA_SYNC_REFRESH_LIMIT + 1, 1, 1, 10001);

            const summary = await service.summaryOf(samples, PROJECTS, false);

            expect(summary).toEqual({
                categories: [],
                classification: { fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
                objects: { total: 0, validated: 0, predicted: 0 },
                nb_samples_with_stats: 0,
                partial: true,
                nb_samples_pending: ECOTAXA_SYNC_REFRESH_LIMIT + 1,
            });
            // The queue took its first batch at once and waits before the next one.
            expect(service.queued).toBe(ECOTAXA_SYNC_REFRESH_LIMIT + 1 - ECOTAXA_STATS_BATCH);
            await reached;
            expect(held).toBeCalledWith(ECOTAXA_QUEUE_PAUSE_MS);
            expect(batchSizes()).toEqual([50]);

            open();
            await service.idle();
            expect(batchSizes()).toEqual([50, 50, 1]);
            expect(held).toBeCalledTimes(2);
            expect(service.queued).toBe(0);
            expect(stored.size).toBe(ECOTAXA_SYNC_REFRESH_LIMIT + 1);
        });

        test("120 samples of one instance: 3 calls, with a pause between two batches", async () => {
            await service.statsOf(manySamples(120, 1, 1, 10001), PROJECTS);
            await service.idle();

            expect(batchSizes()).toEqual([50, 50, 20]);
            expect(statsCalls().every(([url, token]) => url === "https://ecotaxa.obs-vlfr.fr/" && token === "generic-token-fr")).toBe(true);
            expect(pause).toBeCalledTimes(2);
            expect(pause).toBeCalledWith(ECOTAXA_QUEUE_PAUSE_MS);
            expect(stored.size).toBe(120);
        });

        test("beyond the limit: answers at once with the stale values, counts only the samples without stats as pending, and is complete once the queue is drained", async () => {
            const { pause: held, open, reached } = gate();
            service = makeService({ pause: held });
            const samples = manySamples(150, 1, 1, 10001);
            // 40 samples read two days ago, all validated then; EcoTaxa now says every sample is predicted.
            for (let id = 1; id <= 40; id++) stored.set(id, storedRow(id, 10000 + id, clock - 2 * DAY, { nb_validated: 10, used_taxa: [10] }));
            for (let id = 1; id <= 150; id++) statRows.set(10000 + id, statRow(10000 + id, { nb_validated: 0, nb_predicted: 10, used_taxa: [10] }));

            const first = await service.summaryOf(samples, PROJECTS, false);

            expect(first).toEqual({
                categories: ["Copepoda"],
                classification: { fully_validated: 100, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
                objects: { total: 400, validated: 400, predicted: 0 },
                nb_samples_with_stats: 40,
                partial: true,
                nb_samples_pending: 110,
            });
            expect(service.queued).toBe(100);
            await reached;
            expect(statsCalls()[0][2]).toEqual(Array.from({ length: 50 }, (_, i) => 10001 + i));

            open();
            await service.idle();
            expect(service.queued).toBe(0);
            expect(batchSizes()).toEqual([50, 50, 50]);
            expect(stored.size).toBe(150);
            expect(Array.from(stored.values()).every(row => row.nb_predicted === 10 && row.fetched_utc_date_time === new Date(clock).toISOString())).toBe(true);

            const calls_before = ecotaxaCalls();
            const second = await service.summaryOf(samples, PROJECTS, false);
            expect(second).toEqual({
                categories: ["Copepoda"],
                classification: { fully_validated: 0, fully_predicted: 100, partially_validated: 0, partially_predicted: 0 },
                objects: { total: 1500, validated: 0, predicted: 1500 },
                nb_samples_with_stats: 150,
                partial: false,
                nb_samples_pending: 0,
            });
            expect(ecotaxaCalls()).toBe(calls_before);
        });

        test("the queue holds a sample once, however many requests ask for it", async () => {
            const { pause: held, open, reached } = gate();
            service = makeService({ pause: held });
            const samples = manySamples(160, 1, 1, 10001);

            await service.statsOf(samples, PROJECTS);
            await reached;
            expect(service.queued).toBe(110);

            // Asked again while the queue waits: the first batch is served, the 110 others are queued already.
            const again = await service.statsOf(samples, PROJECTS);
            expect(again.size).toBe(50);
            expect(service.queued).toBe(110);

            open();
            await service.idle();
            const asked = statsCalls().flatMap(call => call[2]);
            expect(asked).toHaveLength(160);
            expect(new Set(asked).size).toBe(160);
            expect(stored.size).toBe(160);
        });

        test("a failing batch is logged and the queue goes on with the next ones", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockRejectedValueOnce(new Error("EcoTaxa answered 504"));

            await service.statsOf(manySamples(150, 1, 1, 10001), PROJECTS);
            await service.idle();

            expect(batchSizes()).toEqual([50, 50, 50]);
            expect(service.queued).toBe(0);
            expect(stored.size).toBe(100);
            expect(stored.has(1)).toBe(false);
            expect(stored.has(51)).toBe(true);
            expect(console.log).toBeCalledWith(expect.any(String), "Explore: EcoTaxa sample stats unavailable on instance 1", "EcoTaxa answered 504");
        });

        test("an instance that fails in the queue is logged, the samples of the other instance are saved", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockImplementation(async (url, _token, ids) => {
                if (url === "https://ecotaxa.dev.example.org/") throw new Error("timeout");
                return ids.map(id => statRow(id));
            });

            await service.statsOf([...manySamples(60, 1, 1, 10001), ...manySamples(60, 2, 61, 20001)], PROJECTS);
            await service.idle();

            expect(statsCalls().map(([url, , ids]) => [url, ids.length])).toEqual([
                ["https://ecotaxa.obs-vlfr.fr/", 50],
                ["https://ecotaxa.obs-vlfr.fr/", 10],
                ["https://ecotaxa.dev.example.org/", 40],
                ["https://ecotaxa.dev.example.org/", 20],
            ]);
            expect(Array.from(stored.keys()).sort((a, b) => a - b)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
            expect(console.log).toBeCalledWith(expect.any(String), "Explore: EcoTaxa sample stats unavailable on instance 2", "timeout");
        });

        test("samples queued while the worker is finishing are still read", async () => {
            let release_save!: () => void;
            const save_held = new Promise<void>(resolve => { release_save = resolve; });
            let release_read!: () => void;
            const read_held = new Promise<StoredEcoTaxaStats[]>(resolve => { release_read = () => resolve([]); });
            jest.spyOn(sampleRepository, "saveEcoTaxaStats")
                .mockImplementationOnce(() => save_held)
                .mockImplementation(async (rows) => { for (const row of rows) stored.set(row.sample_id, { ...row }); });
            jest.spyOn(sampleRepository, "getEcoTaxaStats").mockImplementation(() => read_held);
            importedSamples = [importedRow(1, 1, 9001)];
            const flush = () => new Promise<void>(resolve => setImmediate(resolve));

            // The worker reads the one sample of the sweep and waits on its save...
            await service.sweep();
            // ...while a request for 101 other samples waits on the stored stats.
            const request = service.statsOf(manySamples(101, 1, 1001, 30001), PROJECTS);
            await flush();

            // The save ends; the request goes on just after the worker has seen an empty queue.
            release_save();
            Promise.resolve().then(release_read);
            await request;
            await flush();
            await service.idle();

            expect(service.queued).toBe(0);
            expect(stored.size).toBe(101);
        });

        test("once drained, a new request starts the queue again", async () => {
            await service.statsOf(manySamples(120, 1, 1, 10001), PROJECTS);
            await service.idle();
            await service.statsOf(manySamples(110, 1, 1001, 30001), PROJECTS);
            await service.idle();

            expect(batchSizes()).toEqual([50, 50, 20, 50, 50, 10]);
            expect(stored.size).toBe(230);
        });
    });

    describe("sweep", () => {
        test("queues only the samples whose stats are missing or a day old, with the EcoTaxa links of every project", async () => {
            importedSamples = [importedRow(1, 1, 9001), importedRow(2, 1, 9002), importedRow(3, 2, 501), importedRow(4, 3, 9004), importedRow(5, 1, 9005)];
            stored.set(1, storedRow(1, 9001, clock - DAY + 1));
            stored.set(2, storedRow(2, 9002, clock - DAY));
            stored.set(5, storedRow(5, 9005, clock - 3 * DAY));

            const count = await service.sweep();
            await service.idle();

            // Sample 1 is fresh, sample 4 belongs to a project without EcoTaxa.
            expect(count).toBe(3);
            expect(projectRepository.listProjects).toBeCalledTimes(1);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(2);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [9002, 9005]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.dev.example.org/", "generic-token-dev", [501]);
            const now = new Date(clock).toISOString();
            expect([2, 3, 5].map(id => stored.get(id)?.fetched_utc_date_time)).toEqual([now, now, now]);
            expect(stored.get(1)?.fetched_utc_date_time).toBe(new Date(clock - DAY + 1).toISOString());
            expect(stored.has(4)).toBe(false);
        });

        test("nothing to do when every sample is fresh", async () => {
            importedSamples = [importedRow(1, 1, 9001), importedRow(3, 2, 501)];
            stored.set(1, storedRow(1, 9001, clock - 60 * 1000));
            stored.set(3, storedRow(3, 501, clock - DAY + 1));

            await expect(service.sweep()).resolves.toBe(0);

            expect(service.queued).toBe(0);
            expect(projectRepository.listProjects).toBeCalledTimes(0);
            expect(ecotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledTimes(0);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(0);
        });

        test("does not limit the number of samples it queues", async () => {
            importedSamples = Array.from({ length: 250 }, (_, i) => importedRow(i + 1, 1, 10001 + i));

            await expect(service.sweep()).resolves.toBe(250);
            await service.idle();

            expect(batchSizes()).toEqual([50, 50, 50, 50, 50]);
            expect(pause).toBeCalledTimes(4);
            expect(stored.size).toBe(250);
        });

        test("resolves the EcoTaxa ids EcoPart never stored before queuing the samples", async () => {
            importedSamples = [importedRow(7, 1, null)];
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_samples_in_project").mockResolvedValue([{ sampleid: 9007, orig_id: "moose_ge_2024_007" }]);

            await expect(service.sweep()).resolves.toBe(1);
            await service.idle();

            expect(sampleRepository.standardUpdateManySamples).toBeCalledWith({ ecotaxa_sample_id: 9007 }, { sample_id: 7 });
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [9007]);
            expect(stored.get(7)?.ecotaxa_sample_id).toBe(9007);
        });

        test("a sweep while the queue drains queues no sample twice", async () => {
            const { pause: held, open, reached } = gate();
            service = makeService({ pause: held });
            importedSamples = Array.from({ length: 120 }, (_, i) => importedRow(i + 1, 1, 10001 + i));

            await expect(service.sweep()).resolves.toBe(120);
            await reached;
            expect(service.queued).toBe(70);

            // The first batch is saved now: the second sweep finds the 70 others, already queued.
            await expect(service.sweep()).resolves.toBe(70);
            expect(service.queued).toBe(70);

            open();
            await service.idle();
            const asked = statsCalls().flatMap(call => call[2]);
            expect(batchSizes()).toEqual([50, 50, 20]);
            expect(new Set(asked).size).toBe(120);
        });
    });

    describe("throttle", () => {
        test("every EcoTaxa call goes through the injected throttle", async () => {
            const run = jest.spyOn(throttle, "run");
            const pending_at: Record<string, number[]> = { samples: [], stats: [], taxa: [], objects: [] };
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_samples_in_project").mockImplementation(async () => {
                pending_at.samples.push(throttle.pending);
                return [{ sampleid: 9007, orig_id: "moose_ge_2024_007" }];
            });
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockImplementation(async (_url, _token, ids) => {
                pending_at.stats.push(throttle.pending);
                return ids.map(id => statRow(id, { used_taxa: [10] }));
            });
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_taxa").mockImplementation(async (_url, _token, ids) => {
                pending_at.taxa.push(throttle.pending);
                return ids.map(id => TAXA[id]);
            });
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_query_object_set").mockImplementation(async (_url, _token, _project, query: EcoTaxaObjectSetQuery) => {
                pending_at.objects.push(throttle.pending);
                return { total_ids: 10, object_ids: [query.window_start ?? 0], details: [["a.jpg", 12, "2024-06-12", "10:00:00", "Copepoda"]] };
            });

            await service.summaryOf([imported(7, 1, null)], PROJECTS, false);
            await service.randomImagesOf([imported(1, 1, 9001)], PROJECTS, 1);

            // Each call ran while it held a slot of the throttle.
            expect(pending_at).toEqual({ samples: [1], stats: [1], taxa: [1], objects: [1, 1] });
            expect(run).toBeCalledTimes(5);
        });
    });

    describe("filterByClassificationState", () => {
        const samples = [imported(1, 1, 9001), imported(2, 1, 9002), imported(3, 1, 9003), exploreSample({ sample_id: 4, project_id: 1 })];

        beforeEach(() => {
            statRows.set(9001, statRow(9001, { nb_validated: 40 }));
            statRows.set(9002, statRow(9002, { nb_validated: 0, nb_predicted: 40 }));
            statRows.set(9003, statRow(9003, { nb_validated: 20, nb_predicted: 20 }));
        });

        test("'all' keeps every sample without asking EcoTaxa", async () => {
            await expect(service.filterByClassificationState(samples, PROJECTS, exploreFilters({ classification_state: "all" }))).resolves.toBe(samples);
            expect(ecotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledTimes(0);
            expect(sampleRepository.getEcoTaxaStats).toBeCalledTimes(0);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(0);
        });

        test("keeps the samples in the asked state, those without stats are left out", async () => {
            const validated = await service.filterByClassificationState(samples, PROJECTS, exploreFilters({ classification_state: "fully_validated" }));
            expect(validated.map(sample => sample.sample_id)).toEqual([1]);

            const predicted = await service.filterByClassificationState(samples, PROJECTS, exploreFilters({ classification_state: "fully_predicted" }));
            expect(predicted.map(sample => sample.sample_id)).toEqual([2]);
            // The second filter is decided from the stats saved by the first.
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(1);
        });

        test("decides on the stored stats, stale ones included while they are refreshed in the background", async () => {
            const many = manySamples(150, 1, 1, 10001);
            for (let id = 1; id <= 150; id++) stored.set(id, storedRow(id, 10000 + id, clock - 2 * DAY, id <= 30 ? { nb_validated: 10 } : { nb_validated: 0, nb_predicted: 10 }));

            const validated = await service.filterByClassificationState(many, PROJECTS, exploreFilters({ classification_state: "fully_validated" }));

            expect(validated.map(sample => sample.sample_id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
            await service.idle();
            expect(batchSizes()).toEqual([50, 50, 50]);
        });
    });

    describe("summaryOf", () => {
        beforeEach(() => {
            statRows.set(9001, statRow(9001, { nb_validated: 30, used_taxa: [10, 20] }));
            statRows.set(501, statRow(501, { nb_validated: 0, nb_predicted: 12, used_taxa: [20, 30] }));
            statRows.set(9002, statRow(9002, { nb_validated: 0, used_taxa: [] }));
        });

        const samples = () => [imported(1, 1, 9001), imported(2, 2, 501), imported(3, 1, 9002)];

        test("names the categories used, sorted, with the classification of the samples", async () => {
            const summary = await service.summaryOf(samples(), PROJECTS, false);

            expect(summary).toEqual({
                categories: ["Appendicularia", "Copepoda", "detritus"],
                classification: { fully_validated: 50, fully_predicted: 50, partially_validated: 0, partially_predicted: 0 },
                objects: { total: 42, validated: 30, predicted: 12 },
                nb_samples_with_stats: 2,
                partial: false,
                nb_samples_pending: 0,
            });
            expect(ecotaxaAccountRepository.api_ecotaxa_get_taxa).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [10, 20]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_taxa).toBeCalledWith("https://ecotaxa.dev.example.org/", "generic-token-dev", [20, 30]);
        });

        test("leaves out the categories outside the living (biota) lineage when asked", async () => {
            const summary = await service.summaryOf(samples(), PROJECTS, true);

            expect(summary.categories).toEqual(["Appendicularia", "Copepoda"]);
        });

        test("keeps the taxa in cache: only the unknown ones are asked again", async () => {
            await service.summaryOf(samples(), PROJECTS, false);
            await service.summaryOf(samples(), PROJECTS, false);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_taxa).toBeCalledTimes(2);
            // The second summary came from the saved stats.
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(2);

            clock += DAY;
            statRows.set(9001, statRow(9001, { nb_validated: 30, used_taxa: [10, 20, 40] }));
            const summary = await service.summaryOf(samples(), PROJECTS, false);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(4);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_taxa).toBeCalledTimes(3);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_taxa).toHaveBeenLastCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", [40]);
            expect(summary.categories).toEqual(["Appendicularia", "Copepoda", "detritus", "Rhizaria"]);
        });

        test("taxa that cannot be read leave the categories empty, without exception", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_taxa").mockRejectedValue(new Error("EcoTaxa answered 500"));

            const summary = await service.summaryOf(samples(), PROJECTS, false);

            expect(summary.categories).toEqual([]);
            expect(summary.nb_samples_with_stats).toBe(2);
        });

        test("no sample in EcoTaxa: an empty, complete summary", async () => {
            await expect(service.summaryOf([exploreSample()], PROJECTS, true)).resolves.toEqual({
                categories: [],
                classification: { fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
                objects: { total: 0, validated: 0, predicted: 0 },
                nb_samples_with_stats: 0,
                partial: false,
                nb_samples_pending: 0,
            });
            expect(ecotaxaAccountRepository.api_ecotaxa_get_taxa).toBeCalledTimes(0);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(0);
        });
    });

    describe("randomImagesOf", () => {
        const IMAGE_FIELDS = ["img.file_name", "obj.depth_min", "obj.objdate", "obj.objtime", "txo.display_name"];
        let totals: Record<string, number>;

        beforeEach(() => {
            totals = { "9001": 250, "501": 40, "9008": 0 };
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_query_object_set").mockImplementation(async (_url, _token, _project, query: EcoTaxaObjectSetQuery) => {
                const sample = query.filters.samples;
                if (query.fields.length === 0) return { total_ids: totals[sample], object_ids: [1], details: [[]] };
                const start = query.window_start ?? 0;
                return {
                    total_ids: totals[sample],
                    object_ids: [Number(sample) * 1000 + start],
                    details: [[`${sample}/0612/obj_${start}.jpg`, 35.5, "2024-06-12", "10:20:30", "Copepoda"]],
                };
            });
        });

        test("draws a random object of a random sample, with the URL of its image on the instance", async () => {
            randoms = [0, 0.5, 0.99, 0.25];

            const images = await service.randomImagesOf([imported(1, 1, 9001), imported(2, 2, 501)], PROJECTS, 2);

            expect(images).toEqual([
                { object_id: 9001125, image_url: "https://ecotaxa.obs-vlfr.fr/vault/9001/0612/obj_125.jpg", sample_name: "moose_ge_2024_001", depth: 35.5, date: "2024-06-12T10:20:30.000Z" },
                { object_id: 501010, image_url: "https://ecotaxa.dev.example.org/vault/501/0612/obj_10.jpg", sample_name: "moose_ge_2024_002", depth: 35.5, date: "2024-06-12T10:20:30.000Z" },
            ]);
            // The number of objects first (a one-object window), then the drawn object.
            expect(ecotaxaAccountRepository.api_ecotaxa_query_object_set).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", 1450, { filters: { samples: "9001" }, fields: [], window_start: 0, window_size: 1 });
            expect(ecotaxaAccountRepository.api_ecotaxa_query_object_set).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", 1450, { filters: { samples: "9001" }, fields: IMAGE_FIELDS, window_start: 125, window_size: 1 });
            expect(ecotaxaAccountRepository.api_ecotaxa_query_object_set).toBeCalledWith("https://ecotaxa.dev.example.org/", "generic-token-dev", 77, { filters: { samples: "501" }, fields: IMAGE_FIELDS, window_start: 10, window_size: 1 });
            // Images never read the stats.
            expect(sampleRepository.getEcoTaxaStats).toBeCalledTimes(0);
        });

        test("never returns the same object twice, and gives up after three draws per image", async () => {
            randoms = Array.from({ length: 20 }, () => 0.5);

            const images = await service.randomImagesOf([imported(1, 1, 9001)], PROJECTS, 2);

            expect(images.map(image => image.object_id)).toEqual([9001125]);
            const image_queries = (ecotaxaAccountRepository.api_ecotaxa_query_object_set as jest.Mock).mock.calls.filter(call => call[3].fields.length > 0);
            expect(image_queries).toHaveLength(6);
            // The number of objects of the sample is kept in cache.
            const total_queries = (ecotaxaAccountRepository.api_ecotaxa_query_object_set as jest.Mock).mock.calls.filter(call => call[3].fields.length === 0);
            expect(total_queries).toHaveLength(1);
        });

        test(`the number of objects of a sample is asked again after ${ECOTAXA_CACHE_TTL_MS} ms`, async () => {
            await service.randomImagesOf([imported(1, 1, 9001)], PROJECTS, 1);
            clock += ECOTAXA_CACHE_TTL_MS - 1;
            await service.randomImagesOf([imported(1, 1, 9001)], PROJECTS, 1);
            const totalQueries = () => (ecotaxaAccountRepository.api_ecotaxa_query_object_set as jest.Mock).mock.calls.filter(call => call[3].fields.length === 0);
            expect(totalQueries()).toHaveLength(1);

            clock += 1;
            await service.randomImagesOf([imported(1, 1, 9001)], PROJECTS, 1);
            expect(totalQueries()).toHaveLength(2);
        });

        test("drops a sample with no object", async () => {
            randoms = [0, 0, 0, 0];

            const images = await service.randomImagesOf([imported(8, 1, 9008)], PROJECTS, 3);

            expect(images).toEqual([]);
            expect(ecotaxaAccountRepository.api_ecotaxa_query_object_set).toBeCalledTimes(1);
            expect(ecotaxaAccountRepository.api_ecotaxa_query_object_set).toBeCalledWith("https://ecotaxa.obs-vlfr.fr/", "generic-token-fr", 1450, { filters: { samples: "9008" }, fields: [], window_start: 0, window_size: 1 });
        });

        test("once a sample without object is dropped, the draws go to the others", async () => {
            randoms = [0, 0.4, 0];

            const images = await service.randomImagesOf([imported(8, 1, 9008), imported(1, 1, 9001)], PROJECTS, 1);

            expect(images.map(image => image.object_id)).toEqual([9001000]);
            const image_queries = (ecotaxaAccountRepository.api_ecotaxa_query_object_set as jest.Mock).mock.calls.filter(call => call[3].fields.length > 0);
            expect(image_queries.map(call => call[3].filters.samples)).toEqual(["9001"]);
        });

        test("a sample whose query fails is dropped and the others still give images", async () => {
            totals["9002"] = 10;
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_query_object_set").mockImplementation(async (_url, _token, _project, query: EcoTaxaObjectSetQuery) => {
                if (query.filters.samples === "9001") throw new Error("EcoTaxa answered 500");
                return { total_ids: 10, object_ids: [query.window_start ?? 0], details: [["a.jpg", null, null, null, "x"]] };
            });
            randoms = [0, 0, 0.3];

            const images = await service.randomImagesOf([imported(1, 1, 9001), imported(2, 1, 9002)], PROJECTS, 1);

            expect(images).toEqual([{ object_id: 3, image_url: "https://ecotaxa.obs-vlfr.fr/vault/a.jpg", sample_name: "moose_ge_2024_002", depth: null, date: null }]);
        });

        test("an object without image file is not returned", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_query_object_set").mockResolvedValue({ total_ids: 5, object_ids: [42], details: [[null, 12, "2024-06-12", "10:00:00", "x"]] });

            await expect(service.randomImagesOf([imported(1, 1, 9001)], PROJECTS, 1)).resolves.toEqual([]);
        });

        test("no sample imported in EcoTaxa: no image and no call", async () => {
            await expect(service.randomImagesOf([exploreSample()], PROJECTS, 4)).resolves.toEqual([]);
            expect(ecotaxaAccountRepository.api_ecotaxa_query_object_set).toBeCalledTimes(0);
        });
    });
});
