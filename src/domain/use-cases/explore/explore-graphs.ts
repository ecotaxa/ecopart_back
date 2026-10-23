import { BINNED_DEPTH_STEP_M, BINNED_TIME_STEP_H } from "../../constants/binned-export";
import { CTD_LATITUDE_COLUMNS, CTD_LONGITUDE_COLUMNS } from "../../constants/ctd-columns";
import { DETAILED_CLASSES_PER_REDUCED, PART_RED_CLASS_LIMITS_MM, REDUCED_CLASS_COUNT, sizeClassLabel } from "../../constants/size-classes";
import { CtdRows } from "../../entities/ctd";
import { ExploreSampleRow, GraphDataset, ProfileSeries } from "../../entities/explore";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { CTD_PRESSURE_COLUMN, CTD_TIME_COLUMN } from "../../utils/ctd-rows";
import { BinAxis, BinnedSample, BinnedSampleBuilder, BinnedSampleSettings } from "../export/binned-computation";
import { binnedSampleSettingsOf } from "../export/binned-settings";
import { ExploreProjectContext } from "./explore-selection";

/* The curves of the "Selected data graphs" tab: particle abundance and biovolume per reduced size
 * class, and CTD variables, per sample, binned on the depth or on the time axis with the binned
 * export computation. A sample's bins are computed once per (axis, step, project settings, pivot
 * file) and kept in memory: exploring is iterative, and reading a pivot is the whole cost. */

export const EXPLORE_GRAPH_MAX_SAMPLES = 100;
// Beyond this many bins, adjacent bins are merged: a curve of a long time series stays drawable.
export const EXPLORE_GRAPH_MAX_POINTS = 1500;
export const EXPLORE_GRAPH_CONCURRENCY = 3;
export const EXPLORE_GRAPH_CACHE_ENTRIES = 300;
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

// The compact result of a sample: one row per bin, the reduced classes only.
export interface ReducedBins {
    positions: number[];                      // bin centre: depth in m, or epoch ms
    volumes: number[];                        // imaged water volume, litres
    counts: number[][];                       // [bin][reduced class], particles of the visible detailed classes
    biovolumes_mm3: number[][];               // [bin][reduced class]
    visible: boolean[];                       // per reduced class: at least one detailed class visible on the sample
}

export function reduceBinnedSample(sample: BinnedSample): ReducedBins {
    const visible = Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => {
        for (let d = k * DETAILED_CLASSES_PER_REDUCED; d < (k + 1) * DETAILED_CLASSES_PER_REDUCED; d++) if (sample.visible_classes[d]) return true;
        return false;
    });
    const reduced: ReducedBins = { positions: [], volumes: [], counts: [], biovolumes_mm3: [], visible };
    for (const bin of sample.bins) {
        const position = sample.axis === "depth"
            ? ((bin.depth_start_m ?? 0) + (bin.depth_stop_m ?? 0)) / 2
            : ((bin.time_start_ms ?? 0) + (bin.time_stop_ms ?? 0)) / 2;
        const counts = new Array<number>(REDUCED_CLASS_COUNT).fill(0);
        const biovolumes = new Array<number>(REDUCED_CLASS_COUNT).fill(0);
        for (let d = 0; d < sample.visible_classes.length; d++) {
            if (!sample.visible_classes[d]) continue;
            const k = Math.floor(d / DETAILED_CLASSES_PER_REDUCED);
            counts[k] += bin.counts[d];
            biovolumes[k] += bin.biovolumes_mm3[d];
        }
        reduced.positions.push(position);
        reduced.volumes.push(bin.water_volume_l);
        reduced.counts.push(counts);
        reduced.biovolumes_mm3.push(biovolumes);
    }
    return coarsen(reduced, EXPLORE_GRAPH_MAX_POINTS);
}

// Merges groups of adjacent bins until at most `max_points` remain; sums stay sums, so that the
// concentrations of a merged bin are those of the larger bin.
export function coarsen(bins: ReducedBins, max_points: number): ReducedBins {
    const n = bins.positions.length;
    if (n <= max_points) return bins;
    const group = Math.ceil(n / max_points);
    const result: ReducedBins = { positions: [], volumes: [], counts: [], biovolumes_mm3: [], visible: bins.visible };
    for (let start = 0; start < n; start += group) {
        const end = Math.min(n, start + group);
        let position = 0;
        let volume = 0;
        const counts = new Array<number>(REDUCED_CLASS_COUNT).fill(0);
        const biovolumes = new Array<number>(REDUCED_CLASS_COUNT).fill(0);
        for (let i = start; i < end; i++) {
            position += bins.positions[i];
            volume += bins.volumes[i];
            for (let k = 0; k < REDUCED_CLASS_COUNT; k++) {
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

// Least recently used entries go first when the cache is full.
export class LruCache<V> {
    private readonly entries = new Map<string, V>();
    constructor(private readonly max_entries: number) { }
    get(key: string): V | undefined {
        const value = this.entries.get(key);
        if (value === undefined) return undefined;
        this.entries.delete(key);
        this.entries.set(key, value);
        return value;
    }
    set(key: string, value: V): void {
        this.entries.delete(key);
        this.entries.set(key, value);
        if (this.entries.size > this.max_entries) this.entries.delete(this.entries.keys().next().value as string);
    }
    get size(): number { return this.entries.size; }
}

export interface SampleBins {
    sample: ExploreSampleRow;
    bins: ReducedBins;
}

export class ExploreParticleBins {
    private readonly cache = new LruCache<ReducedBins>(EXPLORE_GRAPH_CACHE_ENTRIES);

    constructor(private readonly sampleRepository: SampleRepository) { }

    // Throws "Sample X has no particle data" for a UVP5 without pivot, or the reading error.
    async binsOf(sample: ExploreSampleRow, context: ExploreProjectContext, axis: BinAxis, step: number): Promise<ReducedBins> {
        const settings = binnedSampleSettingsOf(sample, context.project);
        const stamp = await this.sampleRepository.getPivotFileStamp(sample.project_id, sample.sample_name, context.project.instrument_model);
        if (stamp === null) throw new Error(`Sample ${sample.sample_name} has no particle data`);
        const key = `${sample.sample_id}|${axis}|${step}|${settings.descent_filter_enabled}|${settings.depth_offset_m}|${settings.filter_first_image}|${settings.filter_last_image}|${stamp}`;
        const cached = this.cache.get(key);
        if (cached) return cached;
        const bins = reduceBinnedSample(await this.compute(settings, sample, context, axis, step));
        this.cache.set(key, bins);
        return bins;
    }

    private async compute(settings: BinnedSampleSettings, sample: ExploreSampleRow, context: ExploreProjectContext, axis: BinAxis, step: number): Promise<BinnedSample> {
        const pivot = await this.sampleRepository.getPivotImages(sample.project_id, sample.sample_name, context.project.instrument_model);
        const builder = new BinnedSampleBuilder(settings, pivot.columns, { axis, step });
        for await (const record of pivot.rows()) builder.add(record);
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

export function reducedClassKey(k: number): string {
    return sizeClassLabel(PART_RED_CLASS_LIMITS_MM, k);
}

export function buildParticleDatasets(samples: SampleBins[]): { abundance: GraphDataset; biovolume: GraphDataset } {
    const abundance: GraphDataset = { keys: [], axis_labels: {}, series: {} };
    const biovolume: GraphDataset = { keys: [], axis_labels: {}, series: {} };
    for (let k = 0; k < REDUCED_CLASS_COUNT; k++) {
        const key = reducedClassKey(k);
        const abundance_series: ProfileSeries[] = [];
        const biovolume_series: ProfileSeries[] = [];
        for (const { sample, bins } of samples) {
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
        // Legacy EcoPart numbers the reduced classes from 1.
        abundance.keys.push(key);
        abundance.axis_labels[key] = `Particle red. class cl${k + 1} (${key}) # l-1`;
        abundance.series[key] = abundance_series;
        biovolume.keys.push(key);
        biovolume.axis_labels[key] = `Biovolume red. class bv${k + 1} (${key}) mm3 l-1`;
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
