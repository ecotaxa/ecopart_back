import { PivotImageRecord } from "../../entities/binned-export";
import { BINNED_MAX_BINS_PER_SAMPLE, NA } from "../../constants/binned-export";
import { PART_DET_CLASS_LIMITS_MM, SIZE_CLASS_COUNT, sizeClassOfEsd, sizeClassSuffix } from "../../constants/size-classes";
import { selectUsedImages } from "../sample/qc-graphs-builder";
import { toPerImageColumns } from "../../utils/per-image-columns";

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

export function computeBinnedSample(settings: BinnedSampleSettings, records: PivotImageRecord[], options: BinningOptions): BinnedSample {
    const aa_mm2 = aaInMm2(settings.instrument_model, settings.aa);
    const minimum_area_px = minimumAreaPx(settings.particle_minimum_area_px);
    const visible_classes = visibleSizeClasses(aa_mm2, settings.exp, minimum_area_px);

    // The images the QC graphs show as selected. A UVP5 pivot was cut to the operator window at
    // conversion (D2), so only a UVP6 file still has its window applied here.
    const window_cut_at_conversion = settings.instrument_model.startsWith("UVP5");
    const selected = selectUsedImages({
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
        records: toPerImageColumns(records),
    });
    const used = records.filter((_, i) => selected[i]);

    const offset = settings.depth_offset_m ?? 0;
    // Negative depths are forced to 0, as in legacy EcoPart.
    const depthOf = (r: PivotImageRecord): number | null => r.raw_pressure === null ? null : Math.max(0, r.raw_pressure + offset);
    const step_units = Math.round(options.step * (options.axis === "depth" ? UM_PER_M : MS_PER_HOUR));
    // Time bins start at the UTC hour of the first image, like the legacy and the QC graphs.
    let time_origin_ms: number | null = null;
    if (options.axis === "time") {
        for (const r of used) {
            if (r.image_time_ms !== null && (time_origin_ms === null || r.image_time_ms < time_origin_ms)) time_origin_ms = r.image_time_ms;
        }
        if (time_origin_ms !== null) time_origin_ms = Math.floor(time_origin_ms / MS_PER_HOUR) * MS_PER_HOUR;
    }
    const binOf = (r: PivotImageRecord): number | null => {
        if (options.axis === "depth") {
            const depth = depthOf(r);
            return depth === null ? null : Math.floor(Math.round(depth * UM_PER_M) / step_units);
        }
        if (time_origin_ms === null || r.image_time_ms === null) return null;
        return Math.floor((r.image_time_ms - time_origin_ms) / step_units);
    };

    // Areas repeat across images: ESD and unit biovolume are computed once per area.
    const size_by_area = new Map<number, { class_index: number; biovolume_mm3: number }>();
    const sizeOf = (area_px: number) => {
        let size = size_by_area.get(area_px);
        if (!size) {
            const esd = esdMm(area_px, aa_mm2, settings.exp);
            // Legacy `uvp_sample_import.py:685`: biovolume = nb × (esd / 2)³ × 4π / 3.
            size = { class_index: sizeClassOfEsd(esd), biovolume_mm3: Math.pow(esd / 2, 3) * 4 * Math.PI / 3 };
            size_by_area.set(area_px, size);
        }
        return size;
    };

    const accumulators = new Map<number, BinAccumulator>();
    let min_bin = Infinity;
    let max_bin = -Infinity;
    let particles_below_minimum_area = 0;
    for (const r of used) {
        const bin = binOf(r);
        if (bin === null) continue;
        min_bin = Math.min(min_bin, bin);
        max_bin = Math.max(max_bin, bin);
        let acc = accumulators.get(bin);
        if (!acc) { acc = emptyAccumulator(); accumulators.set(bin, acc); }
        if (!r.light_on) {
            acc.nb_black_images++;
            continue;
        }
        // Keeps its place in the profile but adds no volume, as in the QC graphs and legacy EcoPart.
        if (r.particle_data_flag === "OVER_EXPOSED") continue;
        acc.nb_images++;
        if (r.image_time_ms !== null) {
            if (acc.first_time_ms === null || r.image_time_ms < acc.first_time_ms) acc.first_time_ms = r.image_time_ms;
            if (acc.last_time_ms === null || r.image_time_ms > acc.last_time_ms) acc.last_time_ms = r.image_time_ms;
        }
        const depth = depthOf(r);
        if (depth !== null) { acc.depth_sum += depth; acc.depth_count++; }
        for (const block of r.blocks) {
            if (block.area_px < minimum_area_px) {
                particles_below_minimum_area += block.nb_particles;
                continue;
            }
            if (block.area_px === 1) acc.count_1px += block.nb_particles;
            else if (block.area_px === 2) acc.count_2px += block.nb_particles;
            const { class_index, biovolume_mm3 } = sizeOf(block.area_px);
            if (class_index < 0) continue;
            acc.counts[class_index] += block.nb_particles;
            acc.biovolumes_mm3[class_index] += block.nb_particles * biovolume_mm3;
            if (block.grey_mean !== null) {
                acc.grey_sums[class_index] += block.nb_particles * block.grey_mean;
                acc.grey_weights[class_index] += block.nb_particles;
            }
        }
    }

    const on_depth = options.axis === "depth";
    if (max_bin - min_bin + 1 > BINNED_MAX_BINS_PER_SAMPLE) {
        const from = on_depth ? `${formatNumber(min_bin * step_units / UM_PER_M)} m` : new Date((time_origin_ms as number) + min_bin * step_units).toISOString();
        const to = on_depth ? `${formatNumber((max_bin + 1) * step_units / UM_PER_M)} m` : new Date((time_origin_ms as number) + (max_bin + 1) * step_units).toISOString();
        throw new Error(`Sample ${settings.sample_name} would need ${max_bin - min_bin + 1} ${options.axis} bins of ${options.step} ${on_depth ? "m" : "h"} (from ${from} to ${to}), more than the ${BINNED_MAX_BINS_PER_SAMPLE} a sample may have. Check the ${on_depth ? "pressures" : "image times"} of its particle file, or choose a larger step.`);
    }

    // Every bin between the first and the last image is written, an empty one with a zero volume
    // (M5); bins outside the sampled range are not, like legacy EcoPart. The empty bins share one
    // accumulator, which nothing writes to any more.
    const empty = emptyAccumulator();
    const bins: SampleBin[] = [];
    for (let index = min_bin; index <= max_bin; index++) {
        const acc = accumulators.get(index) ?? empty;
        bins.push({
            index,
            depth_start_m: on_depth ? index * step_units / UM_PER_M : (acc.depth_count > 0 ? acc.depth_sum / acc.depth_count : null),
            depth_stop_m: on_depth ? (index + 1) * step_units / UM_PER_M : null,
            time_start_ms: on_depth ? acc.first_time_ms : (time_origin_ms as number) + index * step_units,
            time_stop_ms: on_depth ? acc.last_time_ms : (time_origin_ms as number) + (index + 1) * step_units,
            nb_images: acc.nb_images,
            nb_black_images: acc.nb_black_images,
            water_volume_l: roundTo(acc.nb_images * settings.image_volume_l, VOLUME_DECIMALS),
            count_1px: acc.count_1px,
            count_2px: acc.count_2px,
            counts: acc.counts,
            biovolumes_mm3: acc.biovolumes_mm3,
            grey_sums: acc.grey_sums,
            grey_weights: acc.grey_weights,
        });
    }

    return {
        axis: options.axis,
        visible_classes,
        minimum_area_px,
        black_images_recorded: !settings.instrument_model.startsWith("UVP5"),
        used_images: used.length,
        particles_below_minimum_area,
        bins,
    };
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
