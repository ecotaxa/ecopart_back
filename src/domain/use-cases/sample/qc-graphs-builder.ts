import {
    AxisScale,
    BinnedProfile,
    IMAGE_FLAG_LIGHT_ON,
    IMAGE_FLAG_OVER_EXPOSED,
    ImageFilteringMetadata,
    PerImageColumns,
    SampleQcGraphsResponseModel,
    VerticalAxis,
} from "../../entities/sample-qc-graph";
import { hasImageFlag, imageIdAt, imageTimeAt, rawPressureAt } from "../../utils/per-image-columns";

/* Pure, IO-free QC-graph builder shared by the post-import (GetSampleQcGraphs) and the
 * pre-import (PreviewSamplesQcGraphs) use cases. Both gather the same inputs — a list of
 * per-image records plus a few sample/source settings — and turn them into the three vertical
 * profiles and the image-filtering metadata block. Keeping it here means the binning and
 * pressure→depth conversion stay identical between the two endpoints. */

// Pixel-area classes shown on graph 3 ("for 1, 2 and 3 pixels").
const PIXEL_CLASSES = [1, 2, 3];
// Depth bin thickness in metres — matches the legacy EcoPart raw histogram.
const BIN_SIZE_M = 1;
// Time bin length in hours — the legacy EcoPart time histograms are always hourly.
const BIN_SIZE_H = 1;
const MS_PER_HOUR = 3_600_000;

/* Everything the builder needs, decoupled from the post-import PublicSampleModel so the
 * preview can supply the same fields read straight from the source folder. */
export interface QcGraphInput {
    sample_id: number | null;
    sample_name: string;
    instrument_model: string;
    visual_qc_status_label: string;
    filter_first_image: string | null;
    filter_last_image: string | null;
    instrument_settings_depth_offset_m: number | null;
    instrument_settings_image_volume_l: number | null;
    is_depth_profile: boolean;           // descent filter only applies to depth (pressure) profiles, not time series
    descent_filter_enabled: boolean;     // the project's enable_descent_filter
    records: PerImageColumns;
}

// The sample's vertical axis: where image k sits on it (null = cannot be placed, e.g. no readable time).
interface ProfileAxis {
    kind: VerticalAxis;
    position: (k: number) => number | null;
}

// Which images the sample actually uses, with the descent-filter outcome — computed in one pass.
interface ImageSelection {
    selected: Uint8Array;                // per image: 1 when inside the operator window AND kept by the descent filter
    window_size: number;                 // images inside the operator window [firstimage, endimg]
    kept: number;                        // window images kept by the descent filter (= window_size when it does not apply)
    last_used: number | null;            // deepest kept image (depth profile) or last image of the window
}

// depth (m) = raw_pressure * gain + depth_offset (UVP5 gain 0.1, UVP6 gain 1); null without pressure.
function depthConverter(input: QcGraphInput): (raw_pressure: number | null) => number | null {
    const gain = input.instrument_model.startsWith("UVP5") ? 0.1 : 1;
    const depth_offset = input.instrument_settings_depth_offset_m ?? 0;
    return (raw_pressure: number | null): number | null => raw_pressure === null ? null : raw_pressure * gain + depth_offset;
}

// A depth profile cannot place an image without pressure, so it leaves it out like legacy EcoPart;
// a time series keeps it, placed by its time.
function isPlaceable(input: QcGraphInput, k: number): boolean {
    return !input.is_depth_profile || !Number.isNaN(input.records.raw_pressure[k]);
}

/* Graph 1 is drawn about 400 px wide: past a few thousand points the images overlap, and a long
 * series (a mooring holds millions of images) could not even be sent. Above the limit, the image
 * range is cut into slices and each slice keeps, for the selected and for the removed images apart,
 * its image with the lowest and the one with the highest vertical position: the drawing is the same,
 * spikes included. Images without a vertical position cannot be drawn and are dropped then. */
export const GRAPH1_MAX_SLICES = 1000;

function reduceImagePoints(input: QcGraphInput, placeable_count: number, selected: Uint8Array, axis: ProfileAxis): number[] {
    const records = input.records;
    const placeable: number[] = [];
    if (placeable_count <= GRAPH1_MAX_SLICES * 4) {
        for (let k = 0; k < records.length; k++) if (isPlaceable(input, k)) placeable.push(k);
        return placeable;
    }
    let first_k = -1;
    let last_k = -1;
    for (let k = 0; k < records.length; k++) {
        if (!isPlaceable(input, k)) continue;
        if (first_k === -1) first_k = k;
        last_k = k;
    }
    const first_index = records.image_index[first_k];
    const span = records.image_index[last_k] - first_index + 1;
    // Per slice and per selection state (key = slice * 2 + selected): the images with the lowest and
    // the highest position, -1 while the slice has none.
    const lowest = new Int32Array(GRAPH1_MAX_SLICES * 2).fill(-1);
    const highest = new Int32Array(GRAPH1_MAX_SLICES * 2).fill(-1);
    const lowest_y = new Float64Array(GRAPH1_MAX_SLICES * 2);
    const highest_y = new Float64Array(GRAPH1_MAX_SLICES * 2);
    for (let k = first_k; k <= last_k; k++) {
        if (!isPlaceable(input, k)) continue;
        const y = axis.position(k);
        if (y === null) continue;
        const slice = Math.min(GRAPH1_MAX_SLICES - 1, Math.floor((records.image_index[k] - first_index) * GRAPH1_MAX_SLICES / span));
        const key = slice * 2 + selected[k];
        if (lowest[key] === -1 || y < lowest_y[key]) { lowest[key] = k; lowest_y[key] = y; }
        if (highest[key] === -1 || y > highest_y[key]) { highest[key] = k; highest_y[key] = y; }
    }
    const kept = new Set<number>();
    for (const k of lowest) if (k !== -1) kept.add(k);
    for (const k of highest) if (k !== -1) kept.add(k);
    return Array.from(kept).sort((a, b) => a - b);
}

// Descent-filter outcome alone, for callers that need the metadata without the three profiles
// (the raw-data export reports it in `metadata/samples.tsv`).
export function buildImageFilteringMetadata(input: QcGraphInput): ImageFilteringMetadata {
    const first = normalizeBound(input.filter_first_image);
    const last = normalizeBound(input.filter_last_image);
    return buildImageFiltering(input.records, first, last, selectImages(input, first, last, depthConverter(input)));
}

// Per image, whether the sample uses it (1) or not (0): the selection of graphs 2 and 3, for the
// computed products (the binned export) to count exactly the images the QC graphs show as selected.
export function selectUsedImages(input: QcGraphInput): Uint8Array {
    const first = normalizeBound(input.filter_first_image);
    const last = normalizeBound(input.filter_last_image);
    return selectImages(input, first, last, depthConverter(input)).selected;
}

export function buildSampleQcGraphs(input: QcGraphInput): SampleQcGraphsResponseModel {
    const image_volume_l = input.instrument_settings_image_volume_l ?? 0;
    const toDepth = depthConverter(input);
    const first = normalizeBound(input.filter_first_image);
    const last = normalizeBound(input.filter_last_image);
    const records = input.records;
    const selection = selectImages(input, first, last, toDepth);
    const selected = selection.selected;

    // Time series are profiled against time (hours since the UTC hour of the first image, like the
    // legacy time histograms) — unless no image time is readable, where depth is all there is.
    const time_origin_ms = timeOrigin(records);
    const toHours = (k: number): number | null => {
        const time_ms = imageTimeAt(records, k);
        return time_origin_ms !== null && time_ms !== null ? (time_ms - time_origin_ms) / MS_PER_HOUR : null;
    };
    const axis: ProfileAxis = !input.is_depth_profile && time_origin_ms !== null
        ? { kind: "time", position: toHours }
        : { kind: "depth", position: (k) => toDepth(rawPressureAt(records, k)) };

    // Graphs 2 and 3 only count the images the sample actually uses; graph 1 shows them all.
    // An OVER_EXPOSED line stays on graph 1 and in the descent filter but adds no imaged volume, as in
    // legacy EcoPart. An EMPTY_IMAGE line is a real image in which the UVP found no object to analyse:
    // unlike legacy EcoPart, it counts in the imaged volume.
    const isUsedLit = (k: number) => selected[k] === 1 && hasImageFlag(records, k, IMAGE_FLAG_LIGHT_ON) && !hasImageFlag(records, k, IMAGE_FLAG_OVER_EXPOSED);
    const isUsedBlack = (k: number) => selected[k] === 1 && !hasImageFlag(records, k, IMAGE_FLAG_LIGHT_ON);
    let placeable_count = 0;
    let any_black = false;
    for (let k = 0; k < records.length; k++) {
        if (isPlaceable(input, k)) placeable_count++;
        if (!hasImageFlag(records, k, IMAGE_FLAG_LIGHT_ON)) any_black = true;
    }
    const points = reduceImagePoints(input, placeable_count, selected, axis).map((k) => ({
        image_index: records.image_index[k],
        image_id: imageIdAt(records, k),
        depth_m: toDepth(rawPressureAt(records, k)),
        time_h: toHours(k),
        is_selected: selected[k] === 1,
    }));

    return {
        sample_id: input.sample_id,
        sample_name: input.sample_name,
        instrument_model: input.instrument_model,
        depth_unit: "m",
        vertical_axis: axis.kind,
        time_origin_utc_date_time: time_origin_ms !== null ? new Date(time_origin_ms).toISOString() : null,
        visual_qc_status_label: input.visual_qc_status_label,
        image_depth_profile: {
            points,
            filter_first_image: first,
            filter_last_image: last,
            total_images: placeable_count,
            selected_images: selection.kept,
        },
        // Lit images only: legacy EcoPart derives the imaged volume from the flash-on raw histogram,
        // the black frames being a noise reference.
        imaged_volume_profile: buildVolumeProfile(records, isUsedLit, axis, image_volume_l),
        particle_lpm_profile: buildPixelProfile(records, isUsedLit, axis),
        // null only when the instrument took no dark frame at all.
        black_profile: any_black ? buildPixelProfile(records, isUsedBlack, axis) : null,
        image_filtering: buildImageFiltering(records, first, last, selection),
    };
}

function buildVolumeProfile(records: PerImageColumns, include: (k: number) => boolean, axis: ProfileAxis, image_volume_l: number): BinnedProfile {
    const imgCountByBin = new Map<number, number>();
    for (let k = 0; k < records.length; k++) {
        if (!include(k)) continue;
        const bin = binOf(axis, k);
        if (bin === null) continue;
        imgCountByBin.set(bin, (imgCountByBin.get(bin) ?? 0) + 1);
    }
    const bins = [...imgCountByBin.keys()].sort((a, b) => a - b);
    return binnedProfile(axis, "linear", bins, [
        { label: "imaged volume", unit: "L", values: bins.map((bin) => (imgCountByBin.get(bin) as number) * image_volume_l) },
    ]);
}

function buildPixelProfile(records: PerImageColumns, include: (k: number) => boolean, axis: ProfileAxis): BinnedProfile {
    // bin -> summed count per px class (index px - 1)
    const byBin = new Map<number, number[]>();
    for (let k = 0; k < records.length; k++) {
        if (!include(k)) continue;
        const bin = binOf(axis, k);
        if (bin === null) continue;
        let acc = byBin.get(bin);
        if (!acc) { acc = PIXEL_CLASSES.map(() => 0); byBin.set(bin, acc); }
        for (const px of PIXEL_CLASSES) acc[px - 1] += records.pixel_counts[px - 1][k];
    }
    const bins = [...byBin.keys()].sort((a, b) => a - b);
    return binnedProfile(axis, "log", bins, PIXEL_CLASSES.map((px) => ({
        label: `${px} px`,
        unit: "count",
        values: bins.map((bin) => (byBin.get(bin) as number[])[px - 1]),
    })));
}

function binOf(axis: ProfileAxis, k: number): number | null {
    const position = axis.position(k);
    return position === null ? null : Math.floor(position / (axis.kind === "time" ? BIN_SIZE_H : BIN_SIZE_M));
}

// Series positioned at the bin centres, in metres (depth) or in hours (time).
function binnedProfile(axis: ProfileAxis, suggested_scale: AxisScale, bins: number[], series: { label: string; unit: string; values: number[] }[]): BinnedProfile {
    if (axis.kind === "time") {
        return {
            axis: "time",
            bin_size_h: BIN_SIZE_H,
            suggested_scale,
            series: series.map((s) => ({
                label: s.label,
                unit: s.unit,
                points: bins.map((bin, i) => ({ time_h: bin * BIN_SIZE_H + BIN_SIZE_H / 2, value: s.values[i] })),
            })),
        };
    }
    return {
        axis: "depth",
        bin_size_m: BIN_SIZE_M,
        suggested_scale,
        series: series.map((s) => ({
            label: s.label,
            unit: s.unit,
            points: bins.map((bin, i) => ({ depth_m: bin * BIN_SIZE_M + BIN_SIZE_M / 2, value: s.values[i] })),
        })),
    };
}

// UTC hour of the earliest readable image time — the origin of time_h (legacy: `timestamp // 3600`).
function timeOrigin(records: PerImageColumns): number | null {
    let earliest: number | null = null;
    for (let k = 0; k < records.length; k++) {
        const time_ms = imageTimeAt(records, k);
        if (time_ms !== null && (earliest === null || time_ms < earliest)) earliest = time_ms;
    }
    return earliest === null ? null : Math.floor(earliest / MS_PER_HOUR) * MS_PER_HOUR;
}

/* Descent-filter metadata (mirrors legacy EcoPart uvp_sample_import). first_image / last_image are
 * the operator-selected bounds (header firstimage / endimg; endimg may be a sentinel). The descent
 * filter keeps an image only while depth is non-decreasing (reject when depth < the deepest kept so
 * far); last_image_used is the deepest kept image and removed_images counts the images it drops
 * within the operator's selected window [firstimage, endimg]. */
function buildImageFiltering(records: PerImageColumns, first_image: string | null, last_image: string | null, selection: ImageSelection): ImageFilteringMetadata {
    if (selection.window_size === 0) {
        return { first_image, last_image, last_image_used: null, removed_images: { count: 0, percent: 0 } };
    }
    const count = selection.window_size - selection.kept;   // images dropped by the descent filter
    return {
        first_image,
        last_image,
        last_image_used: selection.last_used !== null ? imageIdAt(records, selection.last_used) : null,
        removed_images: { count, percent: (count / selection.window_size) * 100 },
    };
}

// An image is used when it lies inside the operator window and, on a depth profile whose project
// enables it, the descent filter keeps it: depth >= the deepest kept so far. The filter is
// depth-only (per Marc), so a time series keeps every image of its window.
function selectImages(input: QcGraphInput, first: string | null, last: string | null, toDepth: (p: number | null) => number | null): ImageSelection {
    const records = input.records;
    const inWindow = operatorWindow(input.instrument_model, records, first, last);
    const apply_descent_filter = input.is_depth_profile && input.descent_filter_enabled !== false;

    const selected = new Uint8Array(records.length);
    let window_size = 0;
    let kept = 0;
    let last_used: number | null = null;
    let deepest = -Infinity;
    for (let k = 0; k < records.length; k++) {
        if (!isPlaceable(input, k) || !inWindow(k)) continue;
        window_size++;
        const depth = toDepth(rawPressureAt(records, k));
        if (apply_descent_filter && depth !== null) {
            if (depth < deepest) continue;
            deepest = depth;
        }
        selected[k] = 1;
        kept++;
        last_used = k;
    }
    return { selected, window_size, kept, last_used };
}

/* Whether image k lies inside the operator window [firstimage, endimg]. Numeric bounds are
 * read the way each instrument writes them:
 *  - UVP5: frame indices (datfile col 0 = image_id), compared numerically like legacy EcoPart — so a
 *    bound falling in a numbering gap or before the first frame still works, and the 99999999999 /
 *    9.9999999999E10 "to the end" sentinel simply lies past the last frame;
 *  - UVP6: ranks in the acquisition sequence. UVPapp writes particules.csv from firstimage onwards
 *    (the file holds exactly endimg − firstimage + 1 rows), so row k has rank firstimage + k.
 * A non-numeric bound is matched against the image ids; one that matches nothing leaves its end open. */
function operatorWindow(instrument_model: string, records: PerImageColumns, first: string | null, last: string | null): (k: number) => boolean {
    const is_uvp5 = instrument_model.startsWith("UVP5");
    const is_uvp6 = instrument_model.startsWith("UVP6");
    const first_num = numericBound(first);
    const last_num = numericBound(last);
    let first_pos = -1;
    let last_pos = -1;
    if ((first !== null && first_num === null) || (last !== null && last_num === null)) {
        for (let k = 0; k < records.length; k++) {
            const id = imageIdAt(records, k);
            if (first !== null && first_num === null && first_pos === -1 && id === first) first_pos = k;
            if (last !== null && last_num === null && id === last) last_pos = k;
        }
    }

    return (k: number) => {
        // UVP5 bounds compare with the frame index, read only when a numeric bound needs it.
        const frame = is_uvp5 && (first_num !== null || last_num !== null) ? Number(imageIdAt(records, k)) : NaN;
        let after_first = true;
        let before_last = true;
        if (first_num !== null) {
            if (is_uvp5) after_first = frame >= first_num;
        } else if (first_pos !== -1) {
            after_first = k >= first_pos;
        }
        if (last_num !== null) {
            if (is_uvp5) before_last = frame <= last_num;
            else if (is_uvp6) before_last = (first_num ?? 0) + k <= last_num;
        } else if (last_pos !== -1) {
            before_last = k <= last_pos;
        }
        return after_first && before_last;
    };
}

// Header bounds as trimmed strings ("" = unset); the INI reader may hand over plain numbers.
function normalizeBound(bound: string | null | undefined): string | null {
    if (bound === null || bound === undefined) return null;
    return String(bound).trim() || null;
}

function numericBound(bound: string | null): number | null {
    if (bound === null) return null;
    const n = Number(bound);
    return Number.isFinite(n) ? n : null;
}
