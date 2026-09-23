import {
    AxisScale,
    BinnedProfile,
    ImageFilteringMetadata,
    PerImageRecord,
    SampleQcGraphsResponseModel,
    VerticalAxis,
} from "../../entities/sample-qc-graph";

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
    records: PerImageRecord[];
}

// The sample's vertical axis: where a record sits on it (null = cannot be placed, e.g. no readable time).
interface ProfileAxis {
    kind: VerticalAxis;
    position: (r: PerImageRecord) => number | null;
}

// Which images the sample actually uses, with the descent-filter outcome — computed in one pass.
interface ImageSelection {
    selected: boolean[];                 // per record: inside the operator window AND kept by the descent filter
    window_size: number;                 // images inside the operator window [firstimage, endimg]
    kept: number;                        // window images kept by the descent filter (= window_size when it does not apply)
    last_used: PerImageRecord | null;    // deepest kept image (depth profile) or last image of the window
}

// depth (m) = raw_pressure * gain + depth_offset (UVP5 gain 0.1, UVP6 gain 1).
function depthConverter(input: QcGraphInput): (raw_pressure: number) => number {
    const gain = input.instrument_model.startsWith("UVP5") ? 0.1 : 1;
    const depth_offset = input.instrument_settings_depth_offset_m ?? 0;
    return (raw_pressure: number): number => raw_pressure * gain + depth_offset;
}

// Descent-filter outcome alone, for callers that need the metadata without the three profiles
// (the raw-data export reports it in `metadata/samples.tsv`).
export function buildImageFilteringMetadata(input: QcGraphInput): ImageFilteringMetadata {
    const first = normalizeBound(input.filter_first_image);
    const last = normalizeBound(input.filter_last_image);
    return buildImageFiltering(first, last, selectImages(input, first, last, depthConverter(input)));
}

export function buildSampleQcGraphs(input: QcGraphInput): SampleQcGraphsResponseModel {
    const image_volume_l = input.instrument_settings_image_volume_l ?? 0;
    const toDepth = depthConverter(input);
    const first = normalizeBound(input.filter_first_image);
    const last = normalizeBound(input.filter_last_image);
    const records = input.records;
    const selection = selectImages(input, first, last, toDepth);

    // Time series are profiled against time (hours since the UTC hour of the first image, like the
    // legacy time histograms) — unless no image time is readable, where depth is all there is.
    const time_origin_ms = timeOrigin(records);
    const toHours = (r: PerImageRecord): number | null =>
        time_origin_ms !== null && r.image_time_ms !== null ? (r.image_time_ms - time_origin_ms) / MS_PER_HOUR : null;
    const axis: ProfileAxis = !input.is_depth_profile && time_origin_ms !== null
        ? { kind: "time", position: toHours }
        : { kind: "depth", position: (r) => toDepth(r.raw_pressure) };

    // Graphs 2 and 3 only count the images the sample actually uses; graph 1 shows them all.
    const used = records.filter((_, i) => selection.selected[i]);
    const used_lit = used.filter((r) => r.light_on);

    return {
        sample_id: input.sample_id,
        sample_name: input.sample_name,
        instrument_model: input.instrument_model,
        depth_unit: "m",
        vertical_axis: axis.kind,
        time_origin_utc_date_time: time_origin_ms !== null ? new Date(time_origin_ms).toISOString() : null,
        visual_qc_status_label: input.visual_qc_status_label,
        image_depth_profile: {
            points: records.map((r, i) => ({
                image_index: r.image_index,
                image_id: r.image_id,
                depth_m: toDepth(r.raw_pressure),
                time_h: toHours(r),
                is_selected: selection.selected[i],
            })),
            filter_first_image: first,
            filter_last_image: last,
            total_images: records.length,
            selected_images: used.length,
        },
        // Lit images only: legacy EcoPart derives the imaged volume from the flash-on raw histogram,
        // the black frames being a noise reference.
        imaged_volume_profile: buildVolumeProfile(used_lit, axis, image_volume_l),
        particle_lpm_profile: buildPixelProfile(used_lit, axis),
        // null only when the instrument took no dark frame at all.
        black_profile: records.some((r) => !r.light_on) ? buildPixelProfile(used.filter((r) => !r.light_on), axis) : null,
        image_filtering: buildImageFiltering(first, last, selection),
    };
}

function buildVolumeProfile(records: PerImageRecord[], axis: ProfileAxis, image_volume_l: number): BinnedProfile {
    const imgCountByBin = new Map<number, number>();
    for (const r of records) {
        const bin = binOf(axis, r);
        if (bin === null) continue;
        imgCountByBin.set(bin, (imgCountByBin.get(bin) ?? 0) + 1);
    }
    const bins = [...imgCountByBin.keys()].sort((a, b) => a - b);
    return binnedProfile(axis, "linear", bins, [
        { label: "imaged volume", unit: "L", values: bins.map((bin) => (imgCountByBin.get(bin) as number) * image_volume_l) },
    ]);
}

function buildPixelProfile(records: PerImageRecord[], axis: ProfileAxis): BinnedProfile {
    // bin -> { px class -> summed count }
    const byBin = new Map<number, Record<number, number>>();
    for (const r of records) {
        const bin = binOf(axis, r);
        if (bin === null) continue;
        let acc = byBin.get(bin);
        if (!acc) { acc = {}; byBin.set(bin, acc); }
        for (const px of PIXEL_CLASSES) {
            acc[px] = (acc[px] ?? 0) + (r.spectrum_counts[px] ?? 0);
        }
    }
    const bins = [...byBin.keys()].sort((a, b) => a - b);
    return binnedProfile(axis, "log", bins, PIXEL_CLASSES.map((px) => ({
        label: `${px} px`,
        unit: "count",
        values: bins.map((bin) => (byBin.get(bin) as Record<number, number>)[px] ?? 0),
    })));
}

function binOf(axis: ProfileAxis, r: PerImageRecord): number | null {
    const position = axis.position(r);
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
function timeOrigin(records: PerImageRecord[]): number | null {
    let earliest: number | null = null;
    for (const r of records) {
        if (r.image_time_ms !== null && (earliest === null || r.image_time_ms < earliest)) earliest = r.image_time_ms;
    }
    return earliest === null ? null : Math.floor(earliest / MS_PER_HOUR) * MS_PER_HOUR;
}

/* Descent-filter metadata (mirrors legacy EcoPart uvp_sample_import). first_image / last_image are
 * the operator-selected bounds (header firstimage / endimg; endimg may be a sentinel). The descent
 * filter keeps an image only while depth is non-decreasing (reject when depth < the deepest kept so
 * far); last_image_used is the deepest kept image and removed_images counts the images it drops
 * within the operator's selected window [firstimage, endimg]. */
function buildImageFiltering(first_image: string | null, last_image: string | null, selection: ImageSelection): ImageFilteringMetadata {
    if (selection.window_size === 0) {
        return { first_image, last_image, last_image_used: null, removed_images: { count: 0, percent: 0 } };
    }
    const count = selection.window_size - selection.kept;   // images dropped by the descent filter
    return {
        first_image,
        last_image,
        last_image_used: selection.last_used?.image_id ?? null,
        removed_images: { count, percent: (count / selection.window_size) * 100 },
    };
}

// An image is used when it lies inside the operator window and, on a depth profile whose project
// enables it, the descent filter keeps it: depth >= the deepest kept so far. The filter is
// depth-only (per Marc), so a time series keeps every image of its window.
function selectImages(input: QcGraphInput, first: string | null, last: string | null, toDepth: (p: number) => number): ImageSelection {
    const records = input.records;
    const in_window = operatorWindow(input.instrument_model, records, first, last);
    const apply_descent_filter = input.is_depth_profile && input.descent_filter_enabled !== false;

    const selected = records.map(() => false);
    let window_size = 0;
    let kept = 0;
    let last_used: PerImageRecord | null = null;
    let deepest = -Infinity;
    for (let i = 0; i < records.length; i++) {
        if (!in_window[i]) continue;
        window_size++;
        if (apply_descent_filter) {
            const depth = toDepth(records[i].raw_pressure);
            if (depth < deepest) continue;
            deepest = depth;
        }
        selected[i] = true;
        kept++;
        last_used = records[i];
    }
    return { selected, window_size, kept, last_used };
}

/* Per record, whether it lies inside the operator window [firstimage, endimg]. Numeric bounds are
 * read the way each instrument writes them:
 *  - UVP5: frame indices (datfile col 0 = image_id), compared numerically like legacy EcoPart — so a
 *    bound falling in a numbering gap or before the first frame still works, and the 99999999999 /
 *    9.9999999999E10 "to the end" sentinel simply lies past the last frame;
 *  - UVP6: ranks in the acquisition sequence. UVPapp writes particules.csv from firstimage onwards
 *    (the file holds exactly endimg − firstimage + 1 rows), so row k has rank firstimage + k.
 * A non-numeric bound is matched against the image ids; one that matches nothing leaves its end open. */
function operatorWindow(instrument_model: string, records: PerImageRecord[], first: string | null, last: string | null): boolean[] {
    const is_uvp5 = instrument_model.startsWith("UVP5");
    const is_uvp6 = instrument_model.startsWith("UVP6");
    const first_num = numericBound(first);
    const last_num = numericBound(last);
    const ids = records.map((r) => r.image_id);
    const first_pos = first !== null && first_num === null ? ids.indexOf(first) : -1;
    const last_pos = last !== null && last_num === null ? ids.lastIndexOf(last) : -1;

    return records.map((r, k) => {
        let after_first = true;
        let before_last = true;
        if (first_num !== null) {
            if (is_uvp5) after_first = Number(r.image_id) >= first_num;
        } else if (first_pos !== -1) {
            after_first = k >= first_pos;
        }
        if (last_num !== null) {
            if (is_uvp5) before_last = Number(r.image_id) <= last_num;
            else if (is_uvp6) before_last = (first_num ?? 0) + k <= last_num;
        } else if (last_pos !== -1) {
            before_last = k <= last_pos;
        }
        return after_first && before_last;
    });
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
