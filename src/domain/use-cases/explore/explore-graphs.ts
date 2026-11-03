import { BINNED_DEPTH_STEP_M, BINNED_TIME_STEP_H } from "../../constants/binned-export";
import { CTD_LATITUDE_COLUMNS, CTD_LONGITUDE_COLUMNS } from "../../constants/ctd-columns";
import { DETAILED_CLASSES_PER_REDUCED, detailedClassesOf, PART_DET_CLASS_LIMITS_MM, PART_RED_CLASS_LIMITS_MM, REDUCED_CLASS_COUNT, SIZE_CLASS_COUNT, sizeClassLabel } from "../../constants/size-classes";
import { CtdRows } from "../../entities/ctd";
import { ExploreSampleRow, ExploreSizeClasses, GraphDataset, ProfileSeries } from "../../entities/explore";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { CTD_PRESSURE_COLUMN, CTD_TIME_COLUMN } from "../../utils/ctd-rows";
import { BinAxis, BinnedSample, BinnedSampleBuilder, BinnedSampleSettings } from "../export/binned-computation";
import { binnedSampleSettingsOf } from "../export/binned-settings";
import { ExploreProjectContext } from "./explore-selection";

/* The curves of the "Selected data graphs" tab: particle abundance and biovolume per size class
 * (the reduced or the detailed histogram of legacy EcoPart), and CTD variables, per sample, binned
 * on the depth or on the time axis with the binned export computation. A sample's bins are computed
 * once per (axis, step, project settings, pivot file) and kept in memory with the detailed classes,
 * the reduced ones being sums of them: exploring is iterative, and reading a pivot is the whole cost. */

export const EXPLORE_GRAPH_MAX_SAMPLES = 100;
// The detailed histogram has three times the curves: a third of the samples keeps the response as large.
export const EXPLORE_GRAPH_MAX_DETAILED_SAMPLES = Math.floor(EXPLORE_GRAPH_MAX_SAMPLES / DETAILED_CLASSES_PER_REDUCED);
// Beyond this many bins, adjacent bins are merged: a curve of a long time series stays drawable.
export const EXPLORE_GRAPH_MAX_POINTS = 1500;
export const EXPLORE_GRAPH_CONCURRENCY = 3;
// The cache holds at most this many bins in all, 45 classes each (about 110 MB): a hundred of the
// longest samples, or several hundred profiles.
export const EXPLORE_GRAPH_CACHE_BINS = 150_000;
const MS_PER_HOUR = 3_600_000;
const QC_FLAG_COLUMN = "qc flag";

export interface ExploreGraphSteps {
    pressure_bin: number;                     // metres (dbar)
    time_bin: number;                         // hours
}

export function exploreGraphSteps(pressure_bin: number | undefined, time_bin: number | undefined): ExploreGraphSteps {
    const step = (value: number | undefined, bounds: { default: number; min: number; max: number }, name: string): number => {
        if (value === undefined || value === null) return bounds.default;
        const n = Number(value);
        if (!Number.isFinite(n) || n < bounds.min || n > bounds.max) throw new Error(`${name} must be between ${bounds.min} and ${bounds.max}`);
        return n;
    };
    return { pressure_bin: step(pressure_bin, BINNED_DEPTH_STEP_M, "pressure_bin"), time_bin: step(time_bin, BINNED_TIME_STEP_H, "time_bin") };
}

export const EXPLORE_SIZE_CLASSES: readonly ExploreSizeClasses[] = ["reduced", "detailed"];

// The histogram of the particle curves, reduced by default (the legacy graphs page offers both).
export function exploreSizeClasses(value: string | undefined): ExploreSizeClasses {
    if (value === undefined || value === null) return "reduced";
    if (!EXPLORE_SIZE_CLASSES.includes(value as ExploreSizeClasses)) throw new Error(`size_classes must be one of ${EXPLORE_SIZE_CLASSES.join(", ")}`);
    return value as ExploreSizeClasses;
}

// The compact result of a sample: one row per bin, one column per size class (detailed or reduced).
export interface ParticleBins {
    positions: number[];                      // bin centre: depth in m, or epoch ms
    volumes: number[];                        // imaged water volume, litres
    counts: number[][];                       // [bin][class], particles of the visible classes
    biovolumes_mm3: number[][];               // [bin][class]
    visible: boolean[];                       // per class: visible on the sample
}

// The detailed classes of each bin, the classes the sample cannot see left at zero.
export function detailBinnedSample(sample: BinnedSample): ParticleBins {
    const visible = Array.from({ length: SIZE_CLASS_COUNT }, (_, d) => Boolean(sample.visible_classes[d]));
    const detailed: ParticleBins = { positions: [], volumes: [], counts: [], biovolumes_mm3: [], visible };
    for (const bin of sample.bins) {
        const position = sample.axis === "depth"
            ? ((bin.depth_start_m ?? 0) + (bin.depth_stop_m ?? 0)) / 2
            : ((bin.time_start_ms ?? 0) + (bin.time_stop_ms ?? 0)) / 2;
        detailed.positions.push(position);
        detailed.volumes.push(bin.water_volume_l);
        detailed.counts.push(visible.map((seen, d) => seen ? bin.counts[d] : 0));
        detailed.biovolumes_mm3.push(visible.map((seen, d) => seen ? bin.biovolumes_mm3[d] : 0));
    }
    return coarsen(detailed, EXPLORE_GRAPH_MAX_POINTS);
}

function assertDetailed(bins: ParticleBins): void {
    if (bins.visible.length !== SIZE_CLASS_COUNT) throw new Error(`Detailed bins expected: ${bins.visible.length} classes instead of ${SIZE_CLASS_COUNT}`);
}

// The reduced classes: each the sum of three consecutive detailed classes, visible when any of them is.
export function reduceParticleBins(detailed: ParticleBins): ParticleBins {
    assertDetailed(detailed);
    const groups = Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => detailedClassesOf(k));
    const reduce = (row: number[]) => groups.map(group => group.reduce((sum, d) => sum + row[d], 0));
    return {
        positions: [...detailed.positions],
        volumes: [...detailed.volumes],
        counts: detailed.counts.map(reduce),
        biovolumes_mm3: detailed.biovolumes_mm3.map(reduce),
        visible: groups.map(group => group.some(d => detailed.visible[d])),
    };
}

// Merges groups of adjacent bins until at most `max_points` remain; sums stay sums, so that the
// concentrations of a merged bin are those of the larger bin.
export function coarsen(bins: ParticleBins, max_points: number): ParticleBins {
    const n = bins.positions.length;
    if (n <= max_points) return bins;
    const class_count = bins.visible.length;
    const group = Math.ceil(n / max_points);
    const result: ParticleBins = { positions: [], volumes: [], counts: [], biovolumes_mm3: [], visible: bins.visible };
    for (let start = 0; start < n; start += group) {
        const end = Math.min(n, start + group);
        let position = 0;
        let volume = 0;
        const counts = new Array<number>(class_count).fill(0);
        const biovolumes = new Array<number>(class_count).fill(0);
        for (let i = start; i < end; i++) {
            position += bins.positions[i];
            volume += bins.volumes[i];
            for (let k = 0; k < class_count; k++) {
                counts[k] += bins.counts[i][k];
                biovolumes[k] += bins.biovolumes_mm3[i][k];
            }
        }
        result.positions.push(position / (end - start));
        result.volumes.push(volume);
        result.counts.push(counts);
        result.biovolumes_mm3.push(biovolumes);
    }
    return result;
}

// Least recently used entries go first when the cache is full: it holds at most `max_weight` in
// all, each entry weighing `weigh(value)` (1 by default, so that `max_weight` is a number of entries).
export class LruCache<V> {
    private readonly entries = new Map<string, V>();
    private weight = 0;
    constructor(private readonly max_weight: number, private readonly weigh: (value: V) => number = () => 1) { }
    get(key: string): V | undefined {
        const value = this.entries.get(key);
        if (value === undefined) return undefined;
        this.entries.delete(key);
        this.entries.set(key, value);
        return value;
    }
    set(key: string, value: V): void {
        this.delete(key);
        this.entries.set(key, value);
        this.weight += this.weigh(value);
        while (this.weight > this.max_weight && this.entries.size > 0) this.delete(this.entries.keys().next().value as string);
    }
    private delete(key: string): void {
        const value = this.entries.get(key);
        if (value === undefined) return;
        this.entries.delete(key);
        this.weight -= this.weigh(value);
    }
    get size(): number { return this.entries.size; }
}

export interface SampleBins {
    sample: ExploreSampleRow;
    bins: ParticleBins;
}

export class ExploreParticleBins {
    private readonly cache = new LruCache<ParticleBins>(EXPLORE_GRAPH_CACHE_BINS, bins => Math.max(1, bins.positions.length));

    constructor(private readonly sampleRepository: SampleRepository) { }

    // The detailed classes of the sample (`reduceParticleBins` gives the reduced ones).
    // Throws "Sample X has no particle data" for a UVP5 without pivot, or the reading error.
    async binsOf(sample: ExploreSampleRow, context: ExploreProjectContext, axis: BinAxis, step: number): Promise<ParticleBins> {
        const settings = binnedSampleSettingsOf(sample, context.project);
        const stamp = await this.sampleRepository.getPivotFileStamp(sample.project_id, sample.sample_name, context.project.instrument_model);
        if (stamp === null) throw new Error(`Sample ${sample.sample_name} has no particle data`);
        const key = `${sample.sample_id}|${axis}|${step}|${settings.descent_filter_enabled}|${settings.depth_offset_m}|${settings.filter_first_image}|${settings.filter_last_image}|${stamp}`;
        const cached = this.cache.get(key);
        if (cached) return cached;
        const bins = detailBinnedSample(await this.compute(settings, sample, context, axis, step));
        this.cache.set(key, bins);
        return bins;
    }

    private async compute(settings: BinnedSampleSettings, sample: ExploreSampleRow, context: ExploreProjectContext, axis: BinAxis, step: number): Promise<BinnedSample> {
        const builder = new BinnedSampleBuilder(settings, { axis, step });
        for await (const record of this.sampleRepository.readPivotImages(sample.project_id, sample.sample_name, context.project.instrument_model)) builder.add(record);
        return builder.finish();
    }
}

// Runs `task` over `items`, at most `concurrency` at a time, keeping the order of the results.
export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await task(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
}

/* ─── datasets ─── */

const HISTOGRAMS: Record<ExploreSizeClasses, { limits: readonly number[]; abbreviation: string }> = {
    reduced: { limits: PART_RED_CLASS_LIMITS_MM, abbreviation: "red." },
    detailed: { limits: PART_DET_CLASS_LIMITS_MM, abbreviation: "det." },
};

// `samples` hold the detailed bins, as `ExploreParticleBins` serves them.
export function buildParticleDatasets(samples: SampleBins[], size_classes: ExploreSizeClasses): { abundance: GraphDataset; biovolume: GraphDataset } {
    for (const { bins } of samples) assertDetailed(bins);
    const { limits, abbreviation } = HISTOGRAMS[size_classes];
    const histogram = size_classes === "reduced" ? samples.map(({ sample, bins }) => ({ sample, bins: reduceParticleBins(bins) })) : samples;
    const abundance: GraphDataset = { keys: [], axis_labels: {}, series: {} };
    const biovolume: GraphDataset = { keys: [], axis_labels: {}, series: {} };
    for (let k = 0; k < limits.length - 1; k++) {
        const key = sizeClassLabel(limits, k);
        const abundance_series: ProfileSeries[] = [];
        const biovolume_series: ProfileSeries[] = [];
        for (const { sample, bins } of histogram) {
            if (!bins.visible[k]) continue;
            const abundance_points: ProfileSeries["points"] = [];
            const biovolume_points: ProfileSeries["points"] = [];
            for (let i = 0; i < bins.positions.length; i++) {
                const volume = bins.volumes[i];
                if (!(volume > 0)) continue;
                abundance_points.push({ position: bins.positions[i], value: bins.counts[i][k] / volume });
                biovolume_points.push({ position: bins.positions[i], value: bins.biovolumes_mm3[i][k] / volume });
            }
            if (abundance_points.length === 0) continue;
            abundance_series.push({ sample_id: sample.sample_id, sample_name: sample.sample_name, points: abundance_points });
            biovolume_series.push({ sample_id: sample.sample_id, sample_name: sample.sample_name, points: biovolume_points });
        }
        if (abundance_series.length === 0) continue;
        // Legacy EcoPart numbers the classes from 1.
        abundance.keys.push(key);
        abundance.axis_labels[key] = `Particle ${abbreviation} class cl${k + 1} (${key}) # l-1`;
        abundance.series[key] = abundance_series;
        biovolume.keys.push(key);
        biovolume.axis_labels[key] = `Biovolume ${abbreviation} class bv${k + 1} (${key}) mm3 l-1`;
        biovolume.series[key] = biovolume_series;
    }
    return { abundance, biovolume };
}

/* ─── CTD ─── */

export interface CtdBins {
    positions: number[];
    columns: string[];                        // the variables, in the order of `means`
    means: (number | null)[][];               // [bin][variable], null when the bin has no value
}

const isVariable = (column: string) => column !== CTD_PRESSURE_COLUMN && column !== CTD_TIME_COLUMN && column !== QC_FLAG_COLUMN
    && !CTD_LATITUDE_COLUMNS.has(column) && !CTD_LONGITUDE_COLUMNS.has(column);

// Mean of each variable per bin of pressure (depth axis, with the descent filter when asked: a row
// shallower than the deepest one kept is dropped) or per bin of time.
export function binCtdRows(rows: CtdRows, axis: BinAxis, step: number, descent_filter: boolean): CtdBins {
    const variable_indexes = rows.columns.map((column, index) => ({ column, index })).filter(({ column }) => isVariable(column));
    const columns = variable_indexes.map(({ column }) => column);
    const empty: CtdBins = { positions: [], columns, means: [] };
    const pressure_index = rows.columns.indexOf(CTD_PRESSURE_COLUMN);
    if (axis === "depth" && pressure_index < 0) return empty;

    let origin_ms = 0;
    if (axis === "time") {
        // A loop, not Math.min(...times): a 1 Hz mooring file holds hundreds of thousands of rows.
        let earliest: number | null = null;
        for (const t of rows.time_ms) if (t !== null && (earliest === null || t < earliest)) earliest = t;
        if (earliest === null) return empty;
        origin_ms = Math.floor(earliest / MS_PER_HOUR) * MS_PER_HOUR;
    }
    const step_units = axis === "depth" ? step : step * MS_PER_HOUR;
    const sums = new Map<number, { sum: number[]; n: number[] }>();
    let deepest = -Infinity;
    for (let r = 0; r < rows.values.length; r++) {
        let coordinate: number | null;
        if (axis === "depth") {
            coordinate = rows.values[r][pressure_index];
            if (coordinate === null) continue;
            if (descent_filter) {
                if (coordinate < deepest) continue;
                deepest = coordinate;
            }
            coordinate = Math.max(0, coordinate);
        } else {
            const t = rows.time_ms[r];
            if (t === null) continue;
            coordinate = t - origin_ms;
        }
        const bin = Math.floor(coordinate / step_units);
        let acc = sums.get(bin);
        if (!acc) { acc = { sum: new Array<number>(columns.length).fill(0), n: new Array<number>(columns.length).fill(0) }; sums.set(bin, acc); }
        variable_indexes.forEach(({ index }, v) => {
            const value = rows.values[r][index];
            if (value === null) return;
            acc!.sum[v] += value;
            acc!.n[v]++;
        });
    }
    const bins = Array.from(sums.keys()).sort((a, b) => a - b);
    const result: CtdBins = { positions: [], columns, means: [] };
    for (const bin of bins) {
        const acc = sums.get(bin) as { sum: number[]; n: number[] };
        const centre = (bin + 0.5) * step_units;
        result.positions.push(axis === "depth" ? centre : origin_ms + centre);
        result.means.push(acc.sum.map((sum, v) => acc.n[v] > 0 ? sum / acc.n[v] : null));
    }
    return coarsenCtd(result, EXPLORE_GRAPH_MAX_POINTS);
}

export function coarsenCtd(bins: CtdBins, max_points: number): CtdBins {
    const n = bins.positions.length;
    if (n <= max_points) return bins;
    const group = Math.ceil(n / max_points);
    const result: CtdBins = { positions: [], columns: bins.columns, means: [] };
    for (let start = 0; start < n; start += group) {
        const end = Math.min(n, start + group);
        let position = 0;
        const sum = new Array<number>(bins.columns.length).fill(0);
        const count = new Array<number>(bins.columns.length).fill(0);
        for (let i = start; i < end; i++) {
            position += bins.positions[i];
            bins.means[i].forEach((mean, v) => { if (mean !== null) { sum[v] += mean; count[v]++; } });
        }
        result.positions.push(position / (end - start));
        result.means.push(sum.map((s, v) => count[v] > 0 ? s / count[v] : null));
    }
    return result;
}

export const ctdVariableKey = (column: string) => column.replace(/\s*\[.*\]\s*$/, "").trim();

export function buildCtdDataset(samples: { sample: ExploreSampleRow; bins: CtdBins }[]): GraphDataset {
    const dataset: GraphDataset = { keys: [], axis_labels: {}, series: {} };
    const series_by_column = new Map<string, ProfileSeries[]>();
    for (const { sample, bins } of samples) {
        bins.columns.forEach((column, v) => {
            const points: ProfileSeries["points"] = [];
            for (let i = 0; i < bins.positions.length; i++) {
                const value = bins.means[i][v];
                if (value !== null) points.push({ position: bins.positions[i], value });
            }
            if (points.length === 0) return;
            const list = series_by_column.get(column) ?? [];
            list.push({ sample_id: sample.sample_id, sample_name: sample.sample_name, points });
            series_by_column.set(column, list);
        });
    }
    const columns = Array.from(series_by_column.keys()).sort((a, b) => a.localeCompare(b));
    // Two columns with the same name and different units ("oxygen [umol kg-1]", "oxygen [ml l-1]")
    // keep their unit in the key.
    const short_keys = columns.map(ctdVariableKey);
    for (const [i, column] of columns.entries()) {
        const key = short_keys.indexOf(short_keys[i]) === short_keys.lastIndexOf(short_keys[i]) ? short_keys[i] : column;
        dataset.keys.push(key);
        dataset.axis_labels[key] = `CTD ${column}`;
        dataset.series[key] = series_by_column.get(column) as ProfileSeries[];
    }
    return dataset;
}
