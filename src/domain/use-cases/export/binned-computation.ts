import { PivotImageRecord } from "../../entities/binned-export";
import { IMAGE_FLAG_LIGHT_ON, IMAGE_FLAG_OVER_EXPOSED, PerImageColumns } from "../../entities/sample-qc-graph";
import { BINNED_MAX_BINS_PER_SAMPLE, NA } from "../../constants/binned-export";
import { PART_DET_CLASS_LIMITS_MM, SIZE_CLASS_COUNT, sizeClassOfEsd, sizeClassSuffix } from "../../constants/size-classes";
import { selectUsedImages } from "../sample/qc-graphs-builder";
import { hasImageFlag, imageIdAt, imageTimeAt, rawPressureAt, toPerImageColumns } from "../../utils/per-image-columns";

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
// Whatever the instrument, the pivot is a UVP6-format file: pressures already in decibar.
const PIVOT_FORMAT = "UVP6";

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
    aa: number;                             // as stored: mm²/px for a UVP5, × 10⁶ for a UVP6
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
    bins: SampleBin[];
}

// The UVP6 stores Aa multiplied by 10⁶ (original spec: "for UVP6, value is divided by 10⁶").
export function aaInMm2(instrument_model: string, aa: number): number {
    return instrument_model.startsWith("UVP6") ? aa / 1e6 : aa;
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

export function sampleVisibleSizeClasses(settings: Pick<BinnedSampleSettings, "instrument_model" | "aa" | "exp" | "particle_minimum_area_px">): boolean[] {
    return visibleSizeClasses(aaInMm2(settings.instrument_model, settings.aa), settings.exp, minimumAreaPx(settings.particle_minimum_area_px));
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

/* One sample in two passes over its pivot, so that a mooring of millions of images is never held
 * in memory: the columns (pressure, time, flags) give up front the images used, the time origin and
 * the range of bins; then the rows, read one by one in the same order, bring the particle blocks of
 * the images used. */
export class BinnedSampleBuilder {
    private readonly aa_mm2: number;
    private readonly minimum_area_px: number;
    private readonly visible_classes: boolean[];
    private readonly selected: Uint8Array;
    private readonly used_images: number;
    private readonly time_origin_ms: number | null = null;
    private readonly step_units: number;
    private readonly min_bin: number = Infinity;
    private readonly max_bin: number = -Infinity;
    private readonly accumulators = new Map<number, BinAccumulator>();
    // Areas repeat across images: ESD and unit biovolume are computed once per area.
    private readonly size_by_area = new Map<number, { class_index: number; biovolume_mm3: number }>();
    private particles_below_minimum_area = 0;
    private next_row = 0;

    constructor(private readonly settings: BinnedSampleSettings, private readonly columns: PerImageColumns, private readonly options: BinningOptions) {
        this.aa_mm2 = aaInMm2(settings.instrument_model, settings.aa);
        this.minimum_area_px = minimumAreaPx(settings.particle_minimum_area_px);
        this.visible_classes = visibleSizeClasses(this.aa_mm2, settings.exp, this.minimum_area_px);

        // The images the QC graphs show as selected. A UVP5 pivot was cut to the operator window at
        // conversion (D2), so only a UVP6 file still has its window applied here.
        const window_cut_at_conversion = settings.instrument_model.startsWith("UVP5");
        this.selected = selectUsedImages({
            sample_id: null,
            sample_name: settings.sample_name,
            instrument_model: PIVOT_FORMAT,
            visual_qc_status_label: "",
            filter_first_image: window_cut_at_conversion ? null : settings.filter_first_image,
            filter_last_image: window_cut_at_conversion ? null : settings.filter_last_image,
            instrument_settings_depth_offset_m: settings.depth_offset_m,
            instrument_settings_image_volume_l: settings.image_volume_l,
            is_depth_profile: settings.is_depth_profile,
            descent_filter_enabled: settings.descent_filter_enabled,
            records: columns,
        });
        let used_images = 0;
        for (let k = 0; k < columns.length; k++) used_images += this.selected[k];
        this.used_images = used_images;

        this.step_units = Math.round(options.step * (options.axis === "depth" ? UM_PER_M : MS_PER_HOUR));
        // Time bins start at the UTC hour of the first image, like the legacy and the QC graphs.
        if (options.axis === "time") {
            let earliest: number | null = null;
            for (let k = 0; k < columns.length; k++) {
                const time_ms = imageTimeAt(columns, k);
                if (this.selected[k] && time_ms !== null && (earliest === null || time_ms < earliest)) earliest = time_ms;
            }
            if (earliest !== null) this.time_origin_ms = Math.floor(earliest / MS_PER_HOUR) * MS_PER_HOUR;
        }

        // Every image used that has a place in the profile widens the range, black and over-exposed
        // ones included; checked here, before any particle is read.
        for (let k = 0; k < columns.length; k++) {
            if (!this.selected[k]) continue;
            const bin = this.binAt(k);
            if (bin === null) continue;
            this.min_bin = Math.min(this.min_bin, bin);
            this.max_bin = Math.max(this.max_bin, bin);
        }
        const on_depth = options.axis === "depth";
        if (this.max_bin - this.min_bin + 1 > BINNED_MAX_BINS_PER_SAMPLE) {
            const from = on_depth ? `${formatNumber(this.min_bin * this.step_units / UM_PER_M)} m` : new Date((this.time_origin_ms as number) + this.min_bin * this.step_units).toISOString();
            const to = on_depth ? `${formatNumber((this.max_bin + 1) * this.step_units / UM_PER_M)} m` : new Date((this.time_origin_ms as number) + (this.max_bin + 1) * this.step_units).toISOString();
            throw new Error(`Sample ${settings.sample_name} would need ${this.max_bin - this.min_bin + 1} ${options.axis} bins of ${options.step} ${on_depth ? "m" : "h"} (from ${from} to ${to}), more than the ${BINNED_MAX_BINS_PER_SAMPLE} a sample may have. Check the ${on_depth ? "pressures" : "image times"} of its particle file, or choose a larger step.`);
        }
    }

    // Negative depths are forced to 0, as in legacy EcoPart.
    private depthAt(k: number): number | null {
        const raw_pressure = rawPressureAt(this.columns, k);
        return raw_pressure === null ? null : Math.max(0, raw_pressure + (this.settings.depth_offset_m ?? 0));
    }

    private binAt(k: number): number | null {
        if (this.options.axis === "depth") {
            const depth = this.depthAt(k);
            return depth === null ? null : Math.floor(Math.round(depth * UM_PER_M) / this.step_units);
        }
        const time_ms = imageTimeAt(this.columns, k);
        if (this.time_origin_ms === null || time_ms === null) return null;
        return Math.floor((time_ms - this.time_origin_ms) / this.step_units);
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

    // The next row of the pivot, in file order. Only its particle blocks are read: everything else
    // comes from the columns, read from the same file.
    add(record: PivotImageRecord): void {
        const k = this.next_row++;
        if (k >= this.columns.length || record.image_id !== imageIdAt(this.columns, k)) throw this.changedWhileRead();
        if (!this.selected[k]) return;
        const bin = this.binAt(k);
        if (bin === null) return;
        let acc = this.accumulators.get(bin);
        if (!acc) { acc = emptyAccumulator(); this.accumulators.set(bin, acc); }
        if (!hasImageFlag(this.columns, k, IMAGE_FLAG_LIGHT_ON)) {
            acc.nb_black_images++;
            return;
        }
        // Keeps its place in the profile but adds no volume, as in the QC graphs and legacy EcoPart.
        if (hasImageFlag(this.columns, k, IMAGE_FLAG_OVER_EXPOSED)) return;
        acc.nb_images++;
        const time_ms = imageTimeAt(this.columns, k);
        if (time_ms !== null) {
            if (acc.first_time_ms === null || time_ms < acc.first_time_ms) acc.first_time_ms = time_ms;
            if (acc.last_time_ms === null || time_ms > acc.last_time_ms) acc.last_time_ms = time_ms;
        }
        const depth = this.depthAt(k);
        if (depth !== null) { acc.depth_sum += depth; acc.depth_count++; }
        for (const block of record.blocks) {
            if (block.area_px < this.minimum_area_px) {
                this.particles_below_minimum_area += block.nb_particles;
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
        if (this.next_row !== this.columns.length) throw this.changedWhileRead();
        const on_depth = this.options.axis === "depth";
        const step_units = this.step_units;
        // Every bin between the first and the last image is written, an empty one with a zero volume
        // (M5); bins outside the sampled range are not, like legacy EcoPart. The empty bins share one
        // accumulator, which nothing writes to any more.
        const empty = emptyAccumulator();
        const bins: SampleBin[] = [];
        for (let index = this.min_bin; index <= this.max_bin; index++) {
            const acc = this.accumulators.get(index) ?? empty;
            bins.push({
                index,
                depth_start_m: on_depth ? index * step_units / UM_PER_M : (acc.depth_count > 0 ? acc.depth_sum / acc.depth_count : null),
                depth_stop_m: on_depth ? (index + 1) * step_units / UM_PER_M : null,
                time_start_ms: on_depth ? acc.first_time_ms : (this.time_origin_ms as number) + index * step_units,
                time_stop_ms: on_depth ? acc.last_time_ms : (this.time_origin_ms as number) + (index + 1) * step_units,
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
            used_images: this.used_images,
            particles_below_minimum_area: this.particles_below_minimum_area,
            bins,
        };
    }

    private changedWhileRead(): Error {
        return new Error(`The particle file of sample ${this.settings.sample_name} changed while it was read. Relaunch the export.`);
    }
}

// Both passes over records already in memory.
export function computeBinnedSample(settings: BinnedSampleSettings, records: PivotImageRecord[], options: BinningOptions): BinnedSample {
    const builder = new BinnedSampleBuilder(settings, toPerImageColumns(records), options);
    for (const record of records) builder.add(record);
    return builder.finish();
}

function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/* ─── particles.tsv ─── */

export const PARTICLE_CONTEXT_COLUMNS = [
    "ecopart_sample_id",
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

// The classes written: those visible on at least one exported sample (one table for every
// instrument, Q27 provisional), NA where a sample cannot see one.
export function exportedSizeClasses(visible_per_sample: boolean[][]): number[] {
    const classes: number[] = [];
    for (let class_index = 0; class_index < SIZE_CLASS_COUNT; class_index++) {
        if (visible_per_sample.some((visible) => visible[class_index])) classes.push(class_index);
    }
    return classes;
}

export function particleColumns(class_indexes: number[]): string[] {
    return [
        ...PARTICLE_CONTEXT_COLUMNS,
        ...PIXEL_COLUMNS,
        ...SIZE_CLASS_BLOCKS.flatMap((block) => class_indexes.map((class_index) => `${block}_${sizeClassSuffix(class_index)}`)),
    ];
}

// One row per bin, cells in the order of `particleColumns`.
export function particleRows(sample_id: number, sample: BinnedSample, class_indexes: number[]): string[][] {
    return sample.bins.map((bin) => particleRow(sample_id, sample, bin, class_indexes));
}

export function particleRow(sample_id: number, sample: BinnedSample, bin: SampleBin, class_indexes: number[]): string[] {
    const volume = bin.water_volume_l;
    const sampled = volume > 0;
    const pixelCount = (area_px: number, count: number) => sample.minimum_area_px > area_px || !sampled ? NA : String(count);
    const classCell = (block: typeof SIZE_CLASS_BLOCKS[number], class_index: number): string => {
        if (!sample.visible_classes[class_index]) return NA;
        // No QC is performed yet: Argo flag 0 (M10).
        if (block === "qcflag") return "0";
        if (!sampled) return NA;
        const count = bin.counts[class_index];
        if (block === "count") return String(count);
        if (block === "concentration") return formatNumber(count / volume);
        if (block === "biovolume") return formatNumber(bin.biovolumes_mm3[class_index] / volume);
        return bin.grey_weights[class_index] > 0 ? formatNumber(bin.grey_sums[class_index] / bin.grey_weights[class_index]) : NA;
    };
    return [
        String(sample_id),
        formatTime(bin.time_start_ms),
        formatTime(bin.time_stop_ms),
        bin.depth_start_m === null ? "" : formatNumber(bin.depth_start_m),
        bin.depth_stop_m === null ? "" : formatNumber(bin.depth_stop_m),
        String(bin.nb_images),
        formatNumber(volume),
        "0",
        pixelCount(1, bin.count_1px),
        pixelCount(2, bin.count_2px),
        sample.black_images_recorded ? String(bin.nb_black_images) : NA,
        ...SIZE_CLASS_BLOCKS.flatMap((block) => class_indexes.map((class_index) => classCell(block, class_index))),
    ];
}

// Twelve significant digits: enough for any measured quantity, and no `0.30000000000000004`.
export function formatNumber(value: number): string {
    return String(Number(value.toPrecision(12)));
}

function formatTime(ms: number | null): string {
    return ms === null ? "" : new Date(ms).toISOString();
}
