import { EcotaxaAccountResponseModel, EcotaxaInstanceModel, EcoTaxaObjectSetQuery, EcoTaxaTaxon } from "../../../../src/domain/entities/ecotaxa_account";
import { ExploreSampleRow } from "../../../../src/domain/entities/explore";
import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import {
    classificationSharesOf,
    ECOTAXA_STATS_BATCH,
    ECOTAXA_STATS_TTL_MS,
    EcoTaxaSampleStat,
    ExploreEcoTaxaService,
    matchesClassificationState,
    objectDate,
} from "../../../../src/domain/use-cases/explore/explore-ecotaxa";
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

describe("ExploreEcoTaxaService", () => {
    let ecotaxaAccountRepository: EcotaxaAccountRepository;
    let sampleRepository: SampleRepository;
    let clock: number;
    let randoms: number[];
    let service: ExploreEcoTaxaService;
    let statRows: Map<number, StatRow>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        ecotaxaAccountRepository = new MockEcotaxaAccountRepository();
        sampleRepository = new MockSampleRepository();
        clock = Date.UTC(2026, 9, 22, 8, 0, 0);
        randoms = [];
        service = new ExploreEcoTaxaService(ecotaxaAccountRepository, sampleRepository, () => clock, () => randoms.length > 0 ? randoms.shift() as number : 0);
        statRows = new Map();

        jest.spyOn(ecotaxaAccountRepository, "getOneEcoTaxaInstance").mockImplementation(async (id) => INSTANCES[id] ?? null);
        jest.spyOn(ecotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockImplementation(async (id) => genericAccount(id));
        jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockImplementation(async (_url, _token, ids) =>
            ids.map(id => statRows.get(id) ?? statRow(id)));
        jest.spyOn(sampleRepository, "standardUpdateManySamples").mockResolvedValue(1);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("statsOf", () => {
        test("asks each instance through its generic account, only for the samples imported in EcoTaxa", async () => {
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
        });

        test("a missing used_taxa list is an empty one", async () => {
            statRows.set(9001, { ...statRow(9001), used_taxa: null as unknown as number[] });

            const stats = await service.statsOf([imported(1, 1, 9001)], PROJECTS);

            expect(stats.get(1)?.used_taxa).toEqual([]);
        });

        test(`asks the stats in batches of ${ECOTAXA_STATS_BATCH}`, async () => {
            const samples = Array.from({ length: 450 }, (_, i) => imported(i + 1, 1, 10000 + i));

            const stats = await service.statsOf(samples, PROJECTS);

            expect(stats.size).toBe(450);
            const batches = (ecotaxaAccountRepository.api_ecotaxa_get_sample_stats as jest.Mock).mock.calls.map(call => call[2].length);
            expect(batches).toEqual([200, 200, 50]);
        });

        test("serves the cache within the TTL and asks again after it", async () => {
            const samples = [imported(1, 1, 9001), imported(2, 2, 501)];

            const first = await service.statsOf(samples, PROJECTS);
            clock += ECOTAXA_STATS_TTL_MS - 1;
            const second = await service.statsOf(samples, PROJECTS);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(2);
            expect(second).toEqual(first);

            clock += 1;
            await service.statsOf(samples, PROJECTS);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(4);
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
        });

        test("ids that cannot be resolved are left out without writing anything", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_samples_in_project").mockRejectedValue(new Error("EcoTaxa answered 503"));

            const stats = await service.statsOf([imported(7, 1, null), imported(1, 1, 9001)], PROJECTS);

            expect(sampleRepository.standardUpdateManySamples).toBeCalledTimes(0);
            expect(Array.from(stats.keys())).toEqual([1]);
        });

        test("an instance that does not answer is skipped, the others are served", async () => {
            jest.spyOn(ecotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockImplementation(async (id) => {
                if (id === 2) throw new Error("No generic account for instance 2");
                return genericAccount(id);
            });

            const stats = await service.statsOf([imported(1, 1, 9001), imported(2, 2, 501), imported(3, 2, 502)], PROJECTS);

            expect(Array.from(stats.keys())).toEqual([1]);
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(1);
            // The failure is remembered for the request: the instance is not asked again for sample 3.
            expect(ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance).toBeCalledTimes(2);
        });

        test("an unknown instance is skipped", async () => {
            jest.spyOn(ecotaxaAccountRepository, "getOneEcoTaxaInstance").mockResolvedValue(null);

            await expect(service.statsOf([imported(1, 1, 9001)], PROJECTS)).resolves.toEqual(new Map());
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(0);
        });

        test("a failing stats call leaves the samples of that instance out, without exception", async () => {
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_sample_stats").mockImplementation(async (url, _token, ids) => {
                if (url === "https://ecotaxa.dev.example.org/") throw new Error("timeout");
                return ids.map(id => statRow(id));
            });

            const stats = await service.statsOf([imported(1, 1, 9001), imported(2, 2, 501)], PROJECTS);

            expect(Array.from(stats.keys())).toEqual([1]);
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
            expect(ecotaxaAccountRepository.api_ecotaxa_get_sample_stats).toBeCalledTimes(0);
        });

        test("keeps the samples in the asked state, those without stats are left out", async () => {
            const validated = await service.filterByClassificationState(samples, PROJECTS, exploreFilters({ classification_state: "fully_validated" }));
            expect(validated.map(sample => sample.sample_id)).toEqual([1]);

            const predicted = await service.filterByClassificationState(samples, PROJECTS, exploreFilters({ classification_state: "fully_predicted" }));
            expect(predicted.map(sample => sample.sample_id)).toEqual([2]);
        });
    });

    describe("summaryOf", () => {
        beforeEach(() => {
            statRows.set(9001, statRow(9001, { nb_validated: 30, used_taxa: [10, 20] }));
            statRows.set(501, statRow(501, { nb_validated: 0, nb_predicted: 12, used_taxa: [20, 30] }));
            statRows.set(9002, statRow(9002, { nb_validated: 0, used_taxa: [] }));
            jest.spyOn(ecotaxaAccountRepository, "api_ecotaxa_get_taxa").mockImplementation(async (_url, _token, ids) => ids.map(id => TAXA[id]).filter(Boolean));
        });

        const samples = () => [imported(1, 1, 9001), imported(2, 2, 501), imported(3, 1, 9002)];

        test("names the categories used, sorted, with the classification of the samples", async () => {
            const summary = await service.summaryOf(samples(), PROJECTS, false);

            expect(summary).toEqual({
                categories: ["Appendicularia", "Copepoda", "detritus"],
                classification: { fully_validated: 50, fully_predicted: 50, partially_validated: 0, partially_predicted: 0 },
                nb_samples_with_stats: 2,
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

            clock += ECOTAXA_STATS_TTL_MS;
            statRows.set(9001, statRow(9001, { nb_validated: 30, used_taxa: [10, 20, 40] }));
            const summary = await service.summaryOf(samples(), PROJECTS, false);
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

        test("no sample in EcoTaxa: an empty summary", async () => {
            await expect(service.summaryOf([exploreSample()], PROJECTS, true)).resolves.toEqual({
                categories: [],
                classification: { fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
                nb_samples_with_stats: 0,
            });
            expect(ecotaxaAccountRepository.api_ecotaxa_get_taxa).toBeCalledTimes(0);
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
