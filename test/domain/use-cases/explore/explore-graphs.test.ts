import { PivotImageRecord, PivotParticleBlock } from "../../../../src/domain/entities/binned-export";
import { CtdRows } from "../../../../src/domain/entities/ctd";
import { SIZE_CLASS_COUNT, REDUCED_CLASS_COUNT } from "../../../../src/domain/constants/size-classes";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { BinnedSample, computeBinnedSample, SampleBin } from "../../../../src/domain/use-cases/export/binned-computation";
import { binnedSampleSettingsOf } from "../../../../src/domain/use-cases/export/binned-settings";
import {
    binCtdRows,
    buildCtdDataset,
    buildParticleDatasets,
    coarsen,
    coarsenCtd,
    ctdVariableKey,
    EXPLORE_GRAPH_MAX_POINTS,
    exploreGraphSteps,
    ExploreParticleBins,
    LruCache,
    mapWithConcurrency,
    ReducedBins,
    reduceBinnedSample,
} from "../../../../src/domain/use-cases/explore/explore-graphs";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { exploreContext, exploreProject, exploreSample } from "./explore-fixtures";

const T0 = Date.UTC(2024, 5, 12, 10, 20, 0);
const HOUR = 3_600_000;

describe("exploreGraphSteps", () => {
    test("defaults to the steps of the binned export", () => {
        expect(exploreGraphSteps(undefined, undefined)).toEqual({ pressure_bin: 5, time_bin: 1 });
        expect(exploreGraphSteps(null as unknown as undefined, null as unknown as undefined)).toEqual({ pressure_bin: 5, time_bin: 1 });
    });

    test("accepts steps within the bounds", () => {
        expect(exploreGraphSteps(1, 0.5)).toEqual({ pressure_bin: 1, time_bin: 0.5 });
        expect(exploreGraphSteps(100, 24)).toEqual({ pressure_bin: 100, time_bin: 24 });
        expect(exploreGraphSteps("10" as unknown as number, undefined)).toEqual({ pressure_bin: 10, time_bin: 1 });
    });

    test.each([0, 0.5, 101, NaN, Infinity])("pressure_bin %p is refused", (pressure_bin) => {
        expect(() => exploreGraphSteps(pressure_bin, undefined)).toThrow("pressure_bin must be between 1 and 100");
    });

    test.each([0, 0.4, 25, NaN])("time_bin %p is refused", (time_bin) => {
        expect(() => exploreGraphSteps(undefined, time_bin)).toThrow("time_bin must be between 0.5 and 24");
    });
});

/* ─── particles ─── */

const zeros = () => new Array<number>(SIZE_CLASS_COUNT).fill(0);

function bin(overrides: Partial<SampleBin>): SampleBin {
    return {
        index: 0, depth_start_m: null, depth_stop_m: null, time_start_ms: null, time_stop_ms: null, nb_images: 10, nb_black_images: 0,
        water_volume_l: 5, count_1px: 0, count_2px: 0, counts: zeros(), biovolumes_mm3: zeros(), grey_sums: zeros(), grey_weights: zeros(),
        ...overrides,
    };
}

const withValues = (values: Record<number, number>) => { const array = zeros(); for (const [d, v] of Object.entries(values)) array[Number(d)] = v; return array; };

// A UVP6 sees the detailed classes from 17 (50.8 µm) up.
const UVP6_VISIBLE = Array.from({ length: SIZE_CLASS_COUNT }, (_, d) => d >= 17);

function binnedSample(axis: "depth" | "time", bins: SampleBin[], visible_classes = UVP6_VISIBLE): BinnedSample {
    return { axis, visible_classes, minimum_area_px: 1, black_images_recorded: true, used_images: 100, particles_below_minimum_area: 0, bins };
}

function reducedBins(rows: Array<{ position: number; volume: number; counts?: Record<number, number>; biovolumes?: Record<number, number> }>, visible_classes: number[]): ReducedBins {
    const fill = (values: Record<number, number> = {}) => { const array = new Array<number>(REDUCED_CLASS_COUNT).fill(0); for (const [k, v] of Object.entries(values)) array[Number(k)] = v; return array; };
    return {
        positions: rows.map(row => row.position),
        volumes: rows.map(row => row.volume),
        counts: rows.map(row => fill(row.counts)),
        biovolumes_mm3: rows.map(row => fill(row.biovolumes)),
        visible: Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => visible_classes.includes(k)),
    };
}

describe("reduceBinnedSample", () => {
    test("sums the visible detailed classes of each reduced class, at the depth bin centres", () => {
        const reduced = reduceBinnedSample(binnedSample("depth", [
            bin({ depth_start_m: 0, depth_stop_m: 5, water_volume_l: 2.5, counts: withValues({ 15: 100, 17: 7, 18: 3, 19: 2, 20: 1, 44: 1 }), biovolumes_mm3: withValues({ 15: 9, 17: 0.07, 18: 0.03, 19: 0.02, 20: 0.01 }) }),
            bin({ index: 1, depth_start_m: 5, depth_stop_m: 10, water_volume_l: 3, counts: withValues({ 18: 4 }), biovolumes_mm3: withValues({ 18: 0.04 }) }),
        ]));

        expect(reduced.positions).toEqual([2.5, 7.5]);
        expect(reduced.volumes).toEqual([2.5, 3]);
        // Reduced class 5 (32-64 µm) is detailed 15, 16, 17: only 17 is visible, the 100 particles of class 15 are left out.
        expect(reduced.counts[0][5]).toBe(7);
        expect(reduced.counts[0][6]).toBe(6);
        expect(reduced.counts[0][14]).toBe(1);
        expect(reduced.counts[1][6]).toBe(4);
        expect(reduced.biovolumes_mm3[0][5]).toBeCloseTo(0.07, 10);
        expect(reduced.biovolumes_mm3[0][6]).toBeCloseTo(0.06, 10);
        expect(reduced.counts[0].slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
        expect(reduced.visible).toEqual(Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => k >= 5));
    });

    test("a reduced class is visible when any of its detailed classes is", () => {
        const visible = Array.from({ length: SIZE_CLASS_COUNT }, (_, d) => d === 20 || d === 21);
        expect(reduceBinnedSample(binnedSample("depth", [], visible)).visible.map((v, k) => v ? k : -1).filter(k => k >= 0)).toEqual([6, 7]);
    });

    test("time series are positioned at the centre of their time bins, in epoch ms", () => {
        const reduced = reduceBinnedSample(binnedSample("time", [
            bin({ time_start_ms: T0, time_stop_ms: T0 + HOUR, depth_start_m: 12, depth_stop_m: 14 }),
            bin({ index: 1, time_start_ms: T0 + HOUR, time_stop_ms: T0 + 2 * HOUR }),
        ]));

        expect(reduced.positions).toEqual([T0 + HOUR / 2, T0 + 1.5 * HOUR]);
    });

    test("a long sample is coarsened to at most the drawable number of points", () => {
        const bins = Array.from({ length: 3001 }, (_, i) => bin({ index: i, depth_start_m: i, depth_stop_m: i + 1, water_volume_l: 1, counts: withValues({ 18: 1 }) }));

        const reduced = reduceBinnedSample(binnedSample("depth", bins));

        expect(reduced.positions.length).toBeLessThanOrEqual(EXPLORE_GRAPH_MAX_POINTS);
        expect(reduced.counts.reduce((sum, row) => sum + row[6], 0)).toBe(3001);
        expect(reduced.volumes.reduce((sum, volume) => sum + volume, 0)).toBe(3001);
    });
});

describe("coarsen", () => {
    const bins = reducedBins([
        { position: 2.5, volume: 1, counts: { 6: 1 }, biovolumes: { 6: 0.1 } },
        { position: 7.5, volume: 2, counts: { 6: 2 }, biovolumes: { 6: 0.2 } },
        { position: 12.5, volume: 3, counts: { 6: 3 }, biovolumes: { 6: 0.3 } },
        { position: 17.5, volume: 4, counts: { 6: 4, 7: 1 }, biovolumes: { 6: 0.4 } },
        { position: 22.5, volume: 5, counts: { 6: 5 }, biovolumes: { 6: 0.5 } },
    ], [6, 7]);

    test("leaves a short sample untouched", () => {
        expect(coarsen(bins, 5)).toBe(bins);
    });

    test("merges adjacent bins, summing volumes, counts and biovolumes, averaging positions", () => {
        const merged = coarsen(bins, 2);

        expect(merged.positions).toEqual([7.5, 20]);
        expect(merged.volumes).toEqual([6, 9]);
        expect(merged.counts.map(row => [row[6], row[7]])).toEqual([[6, 0], [9, 1]]);
        expect(merged.biovolumes_mm3[0][6]).toBeCloseTo(0.6, 10);
        expect(merged.biovolumes_mm3[1][6]).toBeCloseTo(0.9, 10);
        expect(merged.visible).toBe(bins.visible);
    });
});

describe("LruCache", () => {
    test("evicts the least recently used entry", () => {
        const cache = new LruCache<number>(2);
        cache.set("a", 1);
        cache.set("b", 2);
        expect(cache.get("a")).toBe(1);
        cache.set("c", 3);

        expect(cache.size).toBe(2);
        expect(cache.get("b")).toBeUndefined();
        expect(cache.get("a")).toBe(1);
        expect(cache.get("c")).toBe(3);
    });

    test("setting an existing key replaces it without evicting another", () => {
        const cache = new LruCache<string>(2);
        cache.set("a", "first");
        cache.set("b", "second");
        cache.set("a", "again");

        expect(cache.size).toBe(2);
        expect(cache.get("a")).toBe("again");
        expect(cache.get("b")).toBe("second");
        expect(cache.get("missing")).toBeUndefined();
    });
});

// One pivot line; `blocks` are [area_px, nb_particles, grey_mean].
function img(index: number, raw_pressure: number, blocks: Array<[number, number, number | null]>): PivotImageRecord {
    const block_list: PivotParticleBlock[] = blocks.map(([area_px, nb_particles, grey_mean]) => ({ area_px, nb_particles, grey_mean }));
    return {
        image_index: index,
        image_id: `20240612-1020${String(index).padStart(2, "0")}-1`,
        raw_pressure,
        image_time_ms: T0 + index * 1000,
        light_on: true,
        spectrum_counts: Object.fromEntries(block_list.map(b => [b.area_px, b.nb_particles])),
        blocks: block_list,
    };
}

describe("ExploreParticleBins", () => {
    const project = exploreProject(1, "open", { instrument_model: "UVP6LP" });
    const context = exploreContext(project);
    const sample = exploreSample({ sample_id: 31, sample_name: "moose_ge_2024_031", project_id: 1 });
    const records = [img(0, 1, [[1, 12, 30], [2, 5, 40]]), img(1, 3.5, [[3, 2, 50]]), img(2, 7, [[1, 8, 30], [20, 1, 60]])];
    let sampleRepository: SampleRepository;
    let particleBins: ExploreParticleBins;
    let stamp: string | null;

    beforeEach(() => {
        jest.clearAllMocks();
        sampleRepository = new MockSampleRepository();
        particleBins = new ExploreParticleBins(sampleRepository);
        stamp = "1718187600000:52113";
        jest.spyOn(sampleRepository, "getPivotFileStamp").mockImplementation(async () => stamp);
        jest.spyOn(sampleRepository, "getPivotImages").mockImplementation(async () => ({
            columns: toPerImageColumns(records),
            rows: async function* () { for (const record of records) yield record; },
        }));
    });

    test("bins the pivot with the binned export computation, then keeps the reduced classes", async () => {
        const bins = await particleBins.binsOf(sample, context, "depth", 5);

        const expected = reduceBinnedSample(computeBinnedSample(binnedSampleSettingsOf(sample, project), records, { axis: "depth", step: 5 }));
        expect(bins).toEqual(expected);
        expect(bins.positions.length).toBeGreaterThan(0);
        expect(sampleRepository.getPivotFileStamp).toBeCalledWith(1, "moose_ge_2024_031", "UVP6LP");
        expect(sampleRepository.getPivotImages).toBeCalledWith(1, "moose_ge_2024_031", "UVP6LP");
    });

    test("a sample without pivot has no particle data", async () => {
        stamp = null;

        await expect(particleBins.binsOf(sample, context, "depth", 5)).rejects.toThrow("Sample moose_ge_2024_031 has no particle data");
        expect(sampleRepository.getPivotImages).toBeCalledTimes(0);
    });

    test("serves the same pivot from the cache, recomputes when the pivot file changes", async () => {
        const first = await particleBins.binsOf(sample, context, "depth", 5);
        const second = await particleBins.binsOf(sample, context, "depth", 5);
        expect(second).toBe(first);
        expect(sampleRepository.getPivotImages).toBeCalledTimes(1);
        expect(sampleRepository.getPivotFileStamp).toBeCalledTimes(2);

        stamp = "1718191200000:52200";
        const third = await particleBins.binsOf(sample, context, "depth", 5);
        expect(third).not.toBe(first);
        expect(sampleRepository.getPivotImages).toBeCalledTimes(2);
    });

    test("another step, axis or project setting is another entry", async () => {
        await particleBins.binsOf(sample, context, "depth", 5);
        await particleBins.binsOf(sample, context, "depth", 10);
        await particleBins.binsOf(sample, context, "time", 1);
        await particleBins.binsOf(sample, exploreContext({ ...project, enable_descent_filter: true }), "depth", 5);
        expect(sampleRepository.getPivotImages).toBeCalledTimes(4);

        await particleBins.binsOf(sample, context, "depth", 10);
        expect(sampleRepository.getPivotImages).toBeCalledTimes(4);
    });

    test("a reading error is passed on and nothing is cached", async () => {
        jest.spyOn(sampleRepository, "getPivotImages").mockRejectedValueOnce(new Error("ENOENT: no such file"));

        await expect(particleBins.binsOf(sample, context, "depth", 5)).rejects.toThrow("ENOENT: no such file");
        await expect(particleBins.binsOf(sample, context, "depth", 5)).resolves.toBeDefined();
        expect(sampleRepository.getPivotImages).toBeCalledTimes(2);
    });
});

describe("mapWithConcurrency", () => {
    test("keeps the order of the results and never runs more tasks at once than asked", async () => {
        let running = 0;
        let max_running = 0;
        const delays = [30, 5, 20, 1, 15, 2, 8];

        const results = await mapWithConcurrency(delays, 3, async (delay) => {
            running++;
            max_running = Math.max(max_running, running);
            await new Promise(resolve => setTimeout(resolve, delay));
            running--;
            return delay * 2;
        });

        expect(results).toEqual([60, 10, 40, 2, 30, 4, 16]);
        expect(max_running).toBe(3);
    });

    test("an empty list gives an empty result without calling the task", async () => {
        const task = jest.fn();
        await expect(mapWithConcurrency([], 3, task)).resolves.toEqual([]);
        expect(task).toBeCalledTimes(0);
    });
});

describe("buildParticleDatasets", () => {
    const sample_a = exploreSample({ sample_id: 1, sample_name: "moose_001" });
    const sample_b = exploreSample({ sample_id: 2, sample_name: "moose_002" });

    test("one key per reduced class drawn, with legacy axis labels and concentrations per litre", () => {
        const datasets = buildParticleDatasets([
            {
                sample: sample_a, bins: reducedBins([
                    { position: 2.5, volume: 2, counts: { 6: 10 }, biovolumes: { 6: 0.2 } },
                    { position: 7.5, volume: 0, counts: { 6: 5 }, biovolumes: { 6: 0.1 } },
                    { position: 12.5, volume: 4, counts: { 6: 8 }, biovolumes: { 6: 0.4 } },
                ], [6, 7]),
            },
            // Every bin without imaged volume: no curve at all.
            { sample: sample_b, bins: reducedBins([{ position: 2.5, volume: 0, counts: { 6: 3 } }], [6]) },
        ]);

        expect(datasets.abundance.keys).toEqual(["64-128 µm", "128-256 µm"]);
        expect(datasets.biovolume.keys).toEqual(["64-128 µm", "128-256 µm"]);
        expect(datasets.abundance.axis_labels["64-128 µm"]).toBe("Particle red. class cl7 (64-128 µm) # l-1");
        expect(datasets.biovolume.axis_labels["64-128 µm"]).toBe("Biovolume red. class bv7 (64-128 µm) mm3 l-1");
        expect(datasets.abundance.axis_labels["128-256 µm"]).toBe("Particle red. class cl8 (128-256 µm) # l-1");
        expect(datasets.abundance.series["64-128 µm"]).toEqual([{ sample_id: 1, sample_name: "moose_001", points: [{ position: 2.5, value: 5 }, { position: 12.5, value: 2 }] }]);
        expect(datasets.biovolume.series["64-128 µm"]).toEqual([{ sample_id: 1, sample_name: "moose_001", points: [{ position: 2.5, value: 0.1 }, { position: 12.5, value: 0.1 }] }]);
        // A visible class without particle is a curve of zeros, not a missing curve.
        expect(datasets.abundance.series["128-256 µm"][0].points.map(point => point.value)).toEqual([0, 0]);
    });

    test("a class visible on no sample has no key", () => {
        const datasets = buildParticleDatasets([{ sample: sample_a, bins: reducedBins([{ position: 2.5, volume: 2, counts: { 0: 4 } }], [14]) }]);

        expect(datasets.abundance.keys).toEqual([">16.4 mm"]);
        expect(datasets.abundance.axis_labels[">16.4 mm"]).toBe("Particle red. class cl15 (>16.4 mm) # l-1");
        expect(datasets.abundance.series["32-64 µm"]).toBeUndefined();
    });

    test("no sample: empty datasets", () => {
        expect(buildParticleDatasets([])).toEqual({ abundance: { keys: [], axis_labels: {}, series: {} }, biovolume: { keys: [], axis_labels: {}, series: {} } });
    });
});

/* ─── CTD ─── */

const CTD_COLUMNS = ["pressure [db]", "temperature [degc]", "qc flag", "lat", "longitude", "time [yyyymmddhhmmssmmm]", "practical salinity [psu]"];

function ctd(rows: Array<[number | null, number | null, number | null]>, time_ms: (number | null)[] = rows.map(() => null)): CtdRows {
    // [pressure, temperature, salinity]; the flag and the position are constant.
    return { columns: CTD_COLUMNS, values: rows.map(([pressure, temperature, salinity]) => [pressure, temperature, 0, 43.4, 7.8, null, salinity]), time_ms };
}

const rounded = (means: (number | null)[][]) => means.map(row => row.map(value => value === null ? null : Math.round(value * 1000) / 1000));

describe("binCtdRows", () => {
    // A yo-yo: 4 dbar after 6 dbar and -0.5 dbar after 8 dbar are on the way up.
    const yoyo = ctd([[1, 13, 38.1], [3, 12, null], [6, 11, 38.3], [4, 15, 38.5], [null, 99, 99], [8, 10, 38.4], [-0.5, 14, 38.0]]);

    test("averages each variable per pressure bin, leaving out pressure, time, flag and position columns", () => {
        const bins = binCtdRows(yoyo, "depth", 5, false);

        expect(bins.columns).toEqual(["temperature [degc]", "practical salinity [psu]"]);
        expect(bins.positions).toEqual([2.5, 7.5]);
        // A negative pressure counts in the first bin; a row without pressure is left out; a null value is not averaged.
        expect(rounded(bins.means)).toEqual([[13.5, 38.2], [10.5, 38.35]]);
    });

    test("with the descent filter, a row shallower than the deepest one kept is dropped", () => {
        const bins = binCtdRows(yoyo, "depth", 5, true);

        expect(bins.positions).toEqual([2.5, 7.5]);
        expect(rounded(bins.means)).toEqual([[12.5, 38.1], [10.5, 38.35]]);
    });

    test("a bin where a variable has no value gives null for it", () => {
        const bins = binCtdRows(ctd([[1, 13, null], [7, 12, 38.2]]), "depth", 5, false);

        expect(bins.means).toEqual([[13, null], [12, 38.2]]);
    });

    test("bins are sorted by depth and empty bins are not drawn", () => {
        const bins = binCtdRows(ctd([[23, 9, 38.6], [2, 13, 38.1]]), "depth", 5, false);

        expect(bins.positions).toEqual([2.5, 22.5]);
    });

    test("no pressure column: nothing to draw on the depth axis", () => {
        const rows: CtdRows = { columns: ["temperature [degc]"], values: [[13]], time_ms: [T0] };

        expect(binCtdRows(rows, "depth", 5, false)).toEqual({ positions: [], columns: ["temperature [degc]"], means: [] });
    });

    test("on the time axis, bins start at the UTC hour of the first row", () => {
        const rows = ctd([[1, 13, 38.1], [2, 12, 38.2], [3, 11, 38.3], [4, 99, 99]], [T0, T0 + 30 * 60_000, T0 + 80 * 60_000, null]);

        const hourly = binCtdRows(rows, "time", 1, false);
        const origin = Date.UTC(2024, 5, 12, 10, 0, 0);
        expect(hourly.positions).toEqual([origin + 0.5 * HOUR, origin + 1.5 * HOUR]);
        expect(rounded(hourly.means)).toEqual([[12.5, 38.15], [11, 38.3]]);

        const half_hourly = binCtdRows(rows, "time", 0.5, false);
        expect(half_hourly.positions).toEqual([origin + 0.25 * HOUR, origin + 0.75 * HOUR, origin + 1.75 * HOUR]);

        // The descent filter only applies to depth profiles.
        expect(binCtdRows(rows, "time", 1, true)).toEqual(hourly);
    });

    test("no time at all: nothing to draw on the time axis", () => {
        expect(binCtdRows(ctd([[1, 13, 38.1]]), "time", 1, false)).toEqual({ positions: [], columns: ["temperature [degc]", "practical salinity [psu]"], means: [] });
    });

    test("a long time series (250 000 rows) is binned without exceeding the call stack", () => {
        const n = 250_000;
        const rows: CtdRows = { columns: ["temperature [degc]"], values: Array.from({ length: n }, () => [13]), time_ms: Array.from({ length: n }, (_, i) => T0 + i * 1000) };

        const bins = binCtdRows(rows, "time", 1, false);

        expect(bins.positions.length).toBe(Math.ceil((T0 % HOUR + n * 1000) / HOUR));
    });

    test("a long cast is coarsened to at most the drawable number of points", () => {
        const rows = ctd(Array.from({ length: 4000 }, (_, i) => [i, 20 - i / 1000, 38] as [number, number, number]));

        const bins = binCtdRows(rows, "depth", 1, false);

        expect(bins.positions.length).toBeLessThanOrEqual(EXPLORE_GRAPH_MAX_POINTS);
        expect(bins.positions[0]).toBeCloseTo(1.5, 10);
    });
});

describe("coarsenCtd", () => {
    const bins = { positions: [1, 2, 3, 4, 5], columns: ["temperature [degc]", "practical salinity [psu]"], means: [[1, null], [3, null], [5, 2], [7, null], [9, 4]] };

    test("leaves a short cast untouched", () => {
        expect(coarsenCtd(bins, 5)).toBe(bins);
    });

    test("merges adjacent bins, averaging the means that exist", () => {
        expect(coarsenCtd(bins, 2)).toEqual({ positions: [2, 4.5], columns: bins.columns, means: [[3, 2], [8, 4]] });
        expect(coarsenCtd({ positions: [1, 2], columns: ["x"], means: [[null], [null]] }, 1)).toEqual({ positions: [1.5], columns: ["x"], means: [[null]] });
    });
});

describe("ctdVariableKey", () => {
    test("the column title without its unit", () => {
        expect(ctdVariableKey("temperature [degc]")).toBe("temperature");
        expect(ctdVariableKey("practical salinity [psu]")).toBe("practical salinity");
        expect(ctdVariableKey("chloro fluo [mg chl m-3]")).toBe("chloro fluo");
        expect(ctdVariableKey("turbidity")).toBe("turbidity");
    });
});

describe("buildCtdDataset", () => {
    const sample_a = exploreSample({ sample_id: 1, sample_name: "moose_001" });
    const sample_b = exploreSample({ sample_id: 2, sample_name: "moose_002" });

    test("one key per variable, sorted, one series per sample, null means skipped", () => {
        const dataset = buildCtdDataset([
            { sample: sample_a, bins: { positions: [2.5, 7.5], columns: ["temperature [degc]", "practical salinity [psu]"], means: [[13, null], [12, 38.2]] } },
            { sample: sample_b, bins: { positions: [2.5], columns: ["temperature [degc]", "turbidity"], means: [[14, null]] } },
        ]);

        expect(dataset.keys).toEqual(["practical salinity", "temperature"]);
        expect(dataset.axis_labels).toEqual({ "practical salinity": "CTD practical salinity [psu]", temperature: "CTD temperature [degc]" });
        expect(dataset.series["practical salinity"]).toEqual([{ sample_id: 1, sample_name: "moose_001", points: [{ position: 7.5, value: 38.2 }] }]);
        expect(dataset.series.temperature).toEqual([
            { sample_id: 1, sample_name: "moose_001", points: [{ position: 2.5, value: 13 }, { position: 7.5, value: 12 }] },
            { sample_id: 2, sample_name: "moose_002", points: [{ position: 2.5, value: 14 }] },
        ]);
        // A variable without any value is not offered.
        expect(dataset.series.turbidity).toBeUndefined();
    });

    test("no sample: an empty dataset", () => {
        expect(buildCtdDataset([])).toEqual({ keys: [], axis_labels: {}, series: {} });
    });

    test("two columns of the same variable in different units keep their unit in the key", () => {
        const dataset = buildCtdDataset([
            { sample: sample_a, bins: { positions: [2.5], columns: ["oxygen [ml l-1]", "oxygen [umol kg-1]", "temperature [degc]"], means: [[5.6, 245, 13]] } },
            { sample: sample_b, bins: { positions: [2.5], columns: ["oxygen [umol kg-1]"], means: [[250]] } },
        ]);

        expect(dataset.keys).toEqual(["oxygen [ml l-1]", "oxygen [umol kg-1]", "temperature"]);
        expect(dataset.axis_labels["oxygen [ml l-1]"]).toBe("CTD oxygen [ml l-1]");
        expect(dataset.series["oxygen [ml l-1]"].map(series => series.sample_id)).toEqual([1]);
        expect(dataset.series["oxygen [umol kg-1]"].map(series => series.points[0].value)).toEqual([245, 250]);
    });
});
