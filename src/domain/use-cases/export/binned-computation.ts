import { PivotImageRecord } from "../../entities/binned-export";
import { BINNED_MAX_BINS_PER_SAMPLE, NA } from "../../constants/binned-export";
import { PART_DET_CLASS_LIMITS_MM, SIZE_CLASS_COUNT, sizeClassOfEsd, sizeClassSuffix } from "../../constants/size-classes";
import { normalizeBound, numericBound } from "../sample/qc-graphs-builder";
import { serialize } from "./tsv";
import type { TableColumn, TableColumnType, TableValue } from "./table";

/* Binned export (product 1), pure computation: per sample and per bin, the particle counts,
 * concentrations, biovolumes and mean grey of each size class, from the sample's UVP6-format pivot.
 * Formulas and decisions: docs/export-products-and-uvp6-pivot.md §6 (legacy EcoPart
 * `GenerateParticleHistogram`, py/part_app/funcs/uvp_sample_import.py). */

const MS_PER_HOUR = 3_600_000;
// Depths are binned in whole micrometres and times in whole milliseconds, so that a decimal step
// such as 1.1 m puts an image lying on a bound in the bin that starts there, as written.
const UM_PER_M = 1_000_000;
// Volumes are rounded before serving as a divisor, as in legacy EcoPart (`VOLUME_ROUNDING`).
const VOLUME_DECIMALS = 6;

export type BinAxis = "depth" | "time";

export interface BinnedSampleSettings {
    sample_name: string;
    instrument_model: string;               // of the sample's project
    is_depth_profile: boolean;              // the descent filter only applies to depth profiles
    descent_filter_enabled: boolean;        // the project's setting
    filter_first_image: string | null;
    filter_last_image: string | null;
    depth_offset_m: number | null;          // the project override, else the sample's offset
    image_volume_l: number;
    aa: number;                             // mm²/px, for every instrument
    exp: number;
    particle_minimum_area_px: number | null;
}

export interface BinningOptions {
    axis: BinAxis;
    step: number;                           // metres (depth) or hours (time)
}

export interface SampleBin {
    index: number;                          // bin number from 0 m, or from the time origin
    depth_start_m: number | null;           // depth axis: the bin bounds; time axis: mean depth of its images
    depth_stop_m: number | null;
    time_start_ms: number | null;           // time axis: the bin bounds; depth axis: first and last image times
    time_stop_ms: number | null;
    nb_images: number;                      // images that add imaged volume
    nb_black_images: number;
    water_volume_l: number;
    count_1px: number;
    count_2px: number;
    counts: number[];                       // per size class, particles in the images that add volume
    biovolumes_mm3: number[];               // per size class, summed biovolume (not yet divided by the volume)
    grey_sums: number[];                    // per size class, Σ particles × mean grey
    grey_weights: number[];                 // per size class, particles whose block carries a mean grey
}

export interface BinnedSample {
    axis: BinAxis;
    visible_classes: boolean[];
    minimum_area_px: number;
    black_images_recorded: boolean;         // false for the UVP5, which never acquires black images
    used_images: number;                    // images the sample uses (window, descent filter)
    particles_below_minimum_area: number;   // left out of every count, the instrument does not keep them
    total_images: number;                   // rows of the pivot
    positioned_images: number;              // images with a position on the axis, used or not
    bins: SampleBin[];
}

// Legacy `uvp_sample_import.py:684`: esd = 2 × sqrt(area ^ exp × aa / π).
export function esdMm(area_px: number, aa_mm2: number, exp: number): number {
    return 2 * Math.sqrt((Math.pow(area_px, exp) * aa_mm2) / Math.PI);
}

// Smallest area the instrument kept (UVP5 `SMbase`, UVP6 `Limit_lpm_detection_size` in pixels), at least 1 px.
export function minimumAreaPx(particle_minimum_area_px: number | null | undefined): number {
    const area = Number(particle_minimum_area_px);
    return Number.isFinite(area) && area > 1 ? Math.ceil(area) : 1;
}

/* A size class is visible on a sample when an integer pixel area, from the sample's minimum area
 * upwards, has its ESD in it: below the smallest class (M2), between two consecutive pixel areas
 * (M3) or under the minimum area (M2b), a class is NA rather than a zero nobody could count.
 * The candidates are the integers around the inverse of the class's lower bound, checked with the
 * same forward formula as the particles, so no float rounding can disagree with the counts. */
export function visibleSizeClasses(aa_mm2: number, exp: number, min_area_px: number): boolean[] {
    const areaOfEsd = (esd_mm: number) => Math.pow((Math.PI / aa_mm2) * Math.pow(esd_mm / 2, 2), 1 / exp);
    return Array.from({ length: SIZE_CLASS_COUNT }, (_, class_index) => {
        const first = Math.max(min_area_px, Math.floor(areaOfEsd(PART_DET_CLASS_LIMITS_MM[class_index])));
        for (let area = first; area <= first + 2; area++) {
            if (sizeClassOfEsd(esdMm(area, aa_mm2, exp)) === class_index) return true;
        }
        return false;
    });
}

export function sampleVisibleSizeClasses(settings: Pick<BinnedSampleSettings, "aa" | "exp" | "particle_minimum_area_px">): boolean[] {
    return visibleSizeClasses(settings.aa, settings.exp, minimumAreaPx(settings.particle_minimum_area_px));
}

interface BinAccumulator {
    nb_images: number;
    nb_black_images: number;
    first_time_ms: number | null;
    last_time_ms: number | null;
    depth_sum: number;
    depth_count: number;
    count_1px: number;
    count_2px: number;
    counts: number[];
    biovolumes_mm3: number[];
    grey_sums: number[];
    grey_weights: number[];
}

function emptyAccumulator(): BinAccumulator {
    const zeros = () => new Array<number>(SIZE_CLASS_COUNT).fill(0);
    return {
        nb_images: 0, nb_black_images: 0, first_time_ms: null, last_time_ms: null, depth_sum: 0, depth_count: 0,
        count_1px: 0, count_2px: 0, counts: zeros(), biovolumes_mm3: zeros(), grey_sums: zeros(), grey_weights: zeros(),
    };
}

/* One sample in a single pass over its pivot, so that a mooring of millions of images is never
 * held in memory: each row brings the position, the flags and the particle blocks of its image,
 * and the builder keeps the bins only. The images used are those the QC graphs show as selected,
 * the operator window then the descent filter of a depth profile, decided row by row. The pivot
 * is a UVP6-format file, so a numeric bound of the window is a rank in the acquisition sequence
 * (row k has rank firstimage + k) and only `endimg` cuts it. A bound that is not a number names
 * an image id: the window starts at the first occurrence of `firstimage` and ends at the last
 * occurrence of `endimg`, an id that never occurs leaving its end open. Both are decided without
 * a second pass: the builder starts over when `firstimage` occurs, and keeps the bins as they
 * are at each occurrence of `endimg`, which it returns when the file does not end there. A UVP5
 * pivot was cut to the operator window at conversion (D2), so no window applies to it.
 * Time bins are aligned on midnight UTC (multiples of the step since the epoch, the steps dividing
 * 24 h): the same bounds for every sample, and for a 1 h step the UTC hours of the legacy and the
 * QC graphs. Their numbering starts at the bin of the first image used that has a time: an image
 * used that comes earlier in time falls in a bin of negative index. */
export class BinnedSampleBuilder {
    private readonly aa_mm2: number;
    private readonly minimum_area_px: number;
    private readonly visible_classes: boolean[];
    private readonly step_units: number;
    private readonly apply_descent_filter: boolean;
    private readonly first_rank: number | null;
    private readonly last_rank: number | null;
    private readonly first_id: string | null;
    private readonly last_id: string | null;
    private first_id_seen = false;
    private state = emptyState();
    // The bins as they were at the last occurrence of `endimg`, when it names an image id.
    private at_last_id: BinnedState | null = null;
    // Areas repeat across images: ESD and unit biovolume are computed once per area.
    private readonly size_by_area = new Map<number, { class_index: number; biovolume_mm3: number }>();
    private total_images = 0;
    private positioned_images = 0;

    constructor(private readonly settings: BinnedSampleSettings, private readonly options: BinningOptions) {
        this.aa_mm2 = settings.aa;
        this.minimum_area_px = minimumAreaPx(settings.particle_minimum_area_px);
        this.visible_classes = visibleSizeClasses(this.aa_mm2, settings.exp, this.minimum_area_px);
        this.step_units = Math.round(options.step * (options.axis === "depth" ? UM_PER_M : MS_PER_HOUR));
        this.apply_descent_filter = settings.is_depth_profile && settings.descent_filter_enabled !== false;

        const window_cut_at_conversion = settings.instrument_model.startsWith("UVP5");
        const first = window_cut_at_conversion ? null : normalizeBound(settings.filter_first_image);
        const last = window_cut_at_conversion ? null : normalizeBound(settings.filter_last_image);
        this.first_rank = numericBound(first);
        this.last_rank = numericBound(last);
        this.first_id = first !== null && this.first_rank === null ? first : null;
        this.last_id = last !== null && this.last_rank === null ? last : null;
    }

    // The next row of the pivot, in file order.
    add(record: PivotImageRecord): void {
        const k = this.total_images++;
        if ((this.options.axis === "depth" ? record.raw_pressure : record.image_time_ms) !== null) this.positioned_images++;

        if (this.first_id !== null && !this.first_id_seen && record.image_id === this.first_id) {
            this.first_id_seen = true;
            this.state = emptyState();
            // `endimg` occurred before `firstimage`: the window is empty unless it occurs again.
            if (this.at_last_id !== null) this.at_last_id = emptyState();
        }
        const in_window = this.last_rank === null || (this.first_rank ?? 0) + k <= this.last_rank;
        const placeable = !this.settings.is_depth_profile || record.raw_pressure !== null;
        if (placeable && in_window) {
            let used = true;
            if (this.apply_descent_filter && record.raw_pressure !== null) {
                // Compared as the QC graphs compare it: with the offset, not forced to 0.
                const depth = record.raw_pressure + (this.settings.depth_offset_m ?? 0);
                if (depth < this.state.deepest) used = false;
                else this.state.deepest = depth;
            }
            if (used) {
                this.state.used_images++;
                this.accumulate(record);
            }
        }
        if (this.last_id !== null && record.image_id === this.last_id) this.at_last_id = cloneState(this.state);
    }

    // Negative depths are forced to 0, as in legacy EcoPart.
    private depthOf(record: PivotImageRecord): number | null {
        return record.raw_pressure === null ? null : Math.max(0, record.raw_pressure + (this.settings.depth_offset_m ?? 0));
    }

    private binOf(record: PivotImageRecord, time_origin_ms: number | null): number | null {
        if (this.options.axis === "depth") {
            const depth = this.depthOf(record);
            return depth === null ? null : Math.floor(Math.round(depth * UM_PER_M) / this.step_units);
        }
        if (time_origin_ms === null || record.image_time_ms === null) return null;
        return Math.floor((record.image_time_ms - time_origin_ms) / this.step_units);
    }

    private sizeOf(area_px: number): { class_index: number; biovolume_mm3: number } {
        let size = this.size_by_area.get(area_px);
        if (!size) {
            const esd = esdMm(area_px, this.aa_mm2, this.settings.exp);
            // Legacy `uvp_sample_import.py:685`: biovolume = nb × (esd / 2)³ × 4π / 3.
            size = { class_index: sizeClassOfEsd(esd), biovolume_mm3: Math.pow(esd / 2, 3) * 4 * Math.PI / 3 };
            this.size_by_area.set(area_px, size);
        }
        return size;
    }

    // An image used: every one that has a place in the profile widens the range, black and
    // over-exposed ones included.
    private accumulate(record: PivotImageRecord): void {
        const state = this.state;
        if (this.options.axis === "time" && state.time_origin_ms === null && record.image_time_ms !== null) {
            state.time_origin_ms = Math.floor(record.image_time_ms / this.step_units) * this.step_units;
        }
        const bin = this.binOf(record, state.time_origin_ms);
        if (bin === null) return;
        state.min_bin = Math.min(state.min_bin, bin);
        state.max_bin = Math.max(state.max_bin, bin);
        if (state.too_many_bins) return;
        if (state.max_bin - state.min_bin + 1 > BINNED_MAX_BINS_PER_SAMPLE) {
            // The bins are dropped; the range goes on being measured for the error finish() raises.
            state.too_many_bins = true;
            state.accumulators.clear();
            return;
        }
        let acc = state.accumulators.get(bin);
        if (!acc) { acc = emptyAccumulator(); state.accumulators.set(bin, acc); }
        if (!record.light_on) {
            acc.nb_black_images++;
            return;
        }
        // Keeps its place in the profile but adds no volume, as in the QC graphs and legacy EcoPart.
        if (record.particle_data_flag === "OVER_EXPOSED") return;
        acc.nb_images++;
        const time_ms = record.image_time_ms;
        if (time_ms !== null) {
            if (acc.first_time_ms === null || time_ms < acc.first_time_ms) acc.first_time_ms = time_ms;
            if (acc.last_time_ms === null || time_ms > acc.last_time_ms) acc.last_time_ms = time_ms;
        }
        const depth = this.depthOf(record);
        if (depth !== null) { acc.depth_sum += depth; acc.depth_count++; }
        for (const block of record.blocks) {
            if (block.area_px < this.minimum_area_px) {
                state.particles_below_minimum_area += block.nb_particles;
                continue;
            }
            if (block.area_px === 1) acc.count_1px += block.nb_particles;
            else if (block.area_px === 2) acc.count_2px += block.nb_particles;
            const { class_index, biovolume_mm3 } = this.sizeOf(block.area_px);
            if (class_index < 0) continue;
            acc.counts[class_index] += block.nb_particles;
            acc.biovolumes_mm3[class_index] += block.nb_particles * biovolume_mm3;
            if (block.grey_mean !== null) {
                acc.grey_sums[class_index] += block.nb_particles * block.grey_mean;
                acc.grey_weights[class_index] += block.nb_particles;
            }
        }
    }

    finish(): BinnedSample {
        const state = this.at_last_id ?? this.state;
        const on_depth = this.options.axis === "depth";
        const step_units = this.step_units;
        if (state.too_many_bins) {
            const from = on_depth ? `${formatNumber(state.min_bin * step_units / UM_PER_M)} m` : new Date((state.time_origin_ms as number) + state.min_bin * step_units).toISOString();
            const to = on_depth ? `${formatNumber((state.max_bin + 1) * step_units / UM_PER_M)} m` : new Date((state.time_origin_ms as number) + (state.max_bin + 1) * step_units).toISOString();
            throw new Error(`Sample ${this.settings.sample_name} would need ${state.max_bin - state.min_bin + 1} ${this.options.axis} bins of ${this.options.step} ${on_depth ? "m" : "h"} (from ${from} to ${to}), more than the ${BINNED_MAX_BINS_PER_SAMPLE} a sample may have. Check the ${on_depth ? "pressures" : "image times"} of its particle file, or choose a larger step.`);
        }
        // Every bin between the first and the last image is written, an empty one with a zero volume
        // (M5); bins outside the sampled range are not, like legacy EcoPart. The empty bins share one
        // accumulator, which nothing writes to any more.
        const empty = emptyAccumulator();
        const bins: SampleBin[] = [];
        for (let index = state.min_bin; index <= state.max_bin; index++) {
            const acc = state.accumulators.get(index) ?? empty;
            bins.push({
                index,
                depth_start_m: on_depth ? index * step_units / UM_PER_M : (acc.depth_count > 0 ? acc.depth_sum / acc.depth_count : null),
                depth_stop_m: on_depth ? (index + 1) * step_units / UM_PER_M : null,
                time_start_ms: on_depth ? acc.first_time_ms : (state.time_origin_ms as number) + index * step_units,
                time_stop_ms: on_depth ? acc.last_time_ms : (state.time_origin_ms as number) + (index + 1) * step_units,
                nb_images: acc.nb_images,
                nb_black_images: acc.nb_black_images,
                water_volume_l: roundTo(acc.nb_images * this.settings.image_volume_l, VOLUME_DECIMALS),
                count_1px: acc.count_1px,
                count_2px: acc.count_2px,
                counts: acc.counts,
                biovolumes_mm3: acc.biovolumes_mm3,
                grey_sums: acc.grey_sums,
                grey_weights: acc.grey_weights,
            });
        }

        return {
            axis: this.options.axis,
            visible_classes: this.visible_classes,
            minimum_area_px: this.minimum_area_px,
            black_images_recorded: !this.settings.instrument_model.startsWith("UVP5"),
            used_images: state.used_images,
            particles_below_minimum_area: state.particles_below_minimum_area,
            total_images: this.total_images,
            positioned_images: this.positioned_images,
            bins,
        };
    }
}

// What the window decides: dropped when `firstimage` occurs, kept aside when `endimg` occurs.
interface BinnedState {
    accumulators: Map<number, BinAccumulator>;
    min_bin: number;
    max_bin: number;
    too_many_bins: boolean;
    time_origin_ms: number | null;
    deepest: number;                        // descent filter: the deepest image kept so far
    used_images: number;
    particles_below_minimum_area: number;
}

function emptyState(): BinnedState {
    return { accumulators: new Map(), min_bin: Infinity, max_bin: -Infinity, too_many_bins: false, time_origin_ms: null, deepest: -Infinity, used_images: 0, particles_below_minimum_area: 0 };
}

function cloneState(state: BinnedState): BinnedState {
    const accumulators = new Map<number, BinAccumulator>();
    for (const [bin, acc] of state.accumulators) {
        accumulators.set(bin, { ...acc, counts: [...acc.counts], biovolumes_mm3: [...acc.biovolumes_mm3], grey_sums: [...acc.grey_sums], grey_weights: [...acc.grey_weights] });
    }
    return { ...state, accumulators };
}

// The same pass over records already in memory.
export function computeBinnedSample(settings: BinnedSampleSettings, records: PivotImageRecord[], options: BinningOptions): BinnedSample {
    const builder = new BinnedSampleBuilder(settings, options);
    for (const record of records) builder.add(record);
    return builder.finish();
}

function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/* ─── the particle table ─── */

export const PARTICLE_CONTEXT_COLUMNS = [
    "ecopart_sample_id",
    // `depth` or `time`: the axis of the row's bin. Depth profiles and time series share one file,
    // and the time and depth columns do not mean the same thing on the two axes.
    "subsample_bin_type",
    "subsample_utc_date_time_start",
    "subsample_utc_date_time_stop",
    "subsample_depth_start",
    "subsample_depth_stop",
    "subsample_nb_images",
    "subsample_water_volume",
    "subsample_qcflag",
];

// Pixel-based counts and the count of black images, in a block of their own (M1): the pixel
// counts do not stand for the same size from one instrument to another.
export const PIXEL_COLUMNS = ["count_1px", "count_2px", "nb_black_images"];

export const SIZE_CLASS_BLOCKS = ["count", "concentration", "biovolume", "intensity", "qcflag"] as const;

// Types of the columns: identifiers, counts and the Argo flags are integers; bounds, volume and
// the concentration, biovolume and intensity blocks are doubles; the bin times are timestamps.
export const PARTICLE_CONTEXT_COLUMN_TYPES: Record<string, TableColumnType> = {
    ecopart_sample_id: "integer",
    subsample_bin_type: "string",
    subsample_utc_date_time_start: "timestamp",
    subsample_utc_date_time_stop: "timestamp",
    subsample_depth_start: "double",
    subsample_depth_stop: "double",
    subsample_nb_images: "integer",
    subsample_water_volume: "double",
    subsample_qcflag: "integer",
};
export const PIXEL_COLUMN_TYPE: TableColumnType = "integer";
export const SIZE_CLASS_BLOCK_TYPES: Record<typeof SIZE_CLASS_BLOCKS[number], TableColumnType> = {
    count: "integer",
    concentration: "double",
    biovolume: "double",
    intensity: "double",
    qcflag: "integer",
};

// The classes written: those visible on at least one exported sample (one table for every
// instrument, Q27 provisional), NA where a sample cannot see one.
export function exportedSizeClasses(visible_per_sample: boolean[][]): number[] {
    const classes: number[] = [];
    for (let class_index = 0; class_index < SIZE_CLASS_COUNT; class_index++) {
        if (visible_per_sample.some((visible) => visible[class_index])) classes.push(class_index);
    }
    return classes;
}

export function particleTableColumns(class_indexes: number[]): TableColumn[] {
    return [
        ...PARTICLE_CONTEXT_COLUMNS.map((name) => ({ name, type: PARTICLE_CONTEXT_COLUMN_TYPES[name] })),
        ...PIXEL_COLUMNS.map((name) => ({ name, type: PIXEL_COLUMN_TYPE })),
        ...SIZE_CLASS_BLOCKS.flatMap((block) => class_indexes.map((class_index) => ({ name: `${block}_${sizeClassSuffix(class_index)}`, type: SIZE_CLASS_BLOCK_TYPES[block] }))),
    ];
}

export function particleColumns(class_indexes: number[]): string[] {
    return particleTableColumns(class_indexes).map((column) => column.name);
}

// Where a row can lack a value, and what the lack means. The two never share a column (a test
// holds `particleCells` to it), so a null cell of the Parquet form is as telling as the TSV's `NA`
// against its empty cell: the column says which one it stands for.
// Empty cell, the column does not apply to the row: the times of a depth bin crossed without any
// image that adds volume, the mean depth of a time bin without pressure, `subsample_depth_stop`
// of a time bin.
export const PARTICLE_NOT_APPLICABLE_COLUMNS = ["subsample_utc_date_time_start", "subsample_utc_date_time_stop", "subsample_depth_start", "subsample_depth_stop"];
// `NA`, no value exists: a class the sample cannot see, a bin without imaged volume, a mean grey
// without particle, black images on an instrument that never acquires any.
export function particleNoValueColumns(class_indexes: number[]): string[] {
    return [...PIXEL_COLUMNS, ...SIZE_CLASS_BLOCKS.flatMap((block) => class_indexes.map((class_index) => `${block}_${sizeClassSuffix(class_index)}`))];
}

// One row per bin, cells in the order of `particleColumns`: numbers and dates, null for a cell
// that does not apply, the `NA` token where no value exists.
export function particleCells(sample_id: number, sample: BinnedSample, bin: SampleBin, class_indexes: number[]): TableValue[] {
    const volume = bin.water_volume_l;
    const sampled = volume > 0;
    const pixelCount = (area_px: number, count: number): TableValue => sample.minimum_area_px > area_px || !sampled ? NA : count;
    const classCell = (block: typeof SIZE_CLASS_BLOCKS[number], class_index: number): TableValue => {
        if (!sample.visible_classes[class_index]) return NA;
        // No QC is performed yet: Argo flag 0 (M10).
        if (block === "qcflag") return 0;
        if (!sampled) return NA;
        const count = bin.counts[class_index];
        if (block === "count") return count;
        if (block === "concentration") return count / volume;
        if (block === "biovolume") return bin.biovolumes_mm3[class_index] / volume;
        return bin.grey_weights[class_index] > 0 ? bin.grey_sums[class_index] / bin.grey_weights[class_index] : NA;
    };
    return [
        sample_id,
        sample.axis,
        timeValue(bin.time_start_ms),
        timeValue(bin.time_stop_ms),
        bin.depth_start_m,
        bin.depth_stop_m,
        bin.nb_images,
        volume,
        0,
        pixelCount(1, bin.count_1px),
        pixelCount(2, bin.count_2px),
        sample.black_images_recorded ? bin.nb_black_images : NA,
        ...SIZE_CLASS_BLOCKS.flatMap((block) => class_indexes.map((class_index) => classCell(block, class_index))),
    ];
}

// The TSV cells of a bin: numbers with twelve significant digits, `NA` as such, empty for null.
export function particleRows(sample_id: number, sample: BinnedSample, class_indexes: number[]): string[][] {
    return sample.bins.map((bin) => particleRow(sample_id, sample, bin, class_indexes));
}

export function particleRow(sample_id: number, sample: BinnedSample, bin: SampleBin, class_indexes: number[]): string[] {
    return particleCells(sample_id, sample, bin, class_indexes).map((cell) => serialize(cell, formatNumber));
}

// Twelve significant digits: enough for any measured quantity, and no `0.30000000000000004`.
export function formatNumber(value: number): string {
    return String(Number(value.toPrecision(12)));
}

function timeValue(ms: number | null): Date | null {
    return ms === null ? null : new Date(ms);
}
