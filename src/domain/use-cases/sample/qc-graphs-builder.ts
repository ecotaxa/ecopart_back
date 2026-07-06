import {
    BinnedDepthProfile,
    ImageDepthProfile,
    ImageFilteringMetadata,
    PerImageRecord,
    SampleQcGraphsResponseModel,
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
    records: PerImageRecord[];
}

export function buildSampleQcGraphs(input: QcGraphInput): SampleQcGraphsResponseModel {
    // depth (m) = raw_pressure * gain + depth_offset (UVP5 gain 0.1, UVP6 gain 1).
    const gain = input.instrument_model.startsWith("UVP5") ? 0.1 : 1;
    const depth_offset = input.instrument_settings_depth_offset_m ?? 0;
    const image_volume_l = input.instrument_settings_image_volume_l ?? 0;
    const toDepth = (raw_pressure: number): number => raw_pressure * gain + depth_offset;
    const binCentre = (bin: number): number => bin * BIN_SIZE_M + BIN_SIZE_M / 2;

    const records = input.records;
    const light_on = records.filter((r) => r.light_on);
    const light_off = records.filter((r) => !r.light_on);

    return {
        sample_id: input.sample_id,
        sample_name: input.sample_name,
        instrument_model: input.instrument_model,
        depth_unit: "m",
        visual_qc_status_label: input.visual_qc_status_label,
        image_depth_profile: buildImageDepthProfile(input, records, toDepth),
        imaged_volume_profile: buildVolumeProfile(records, toDepth, binCentre, image_volume_l),
        particle_lpm_profile: buildPixelProfile(light_on, toDepth, binCentre),
        black_profile: light_off.length > 0 ? buildPixelProfile(light_off, toDepth, binCentre) : null,
        image_filtering: buildImageFiltering(input, records, toDepth),
    };
}

function buildImageDepthProfile(input: QcGraphInput, records: PerImageRecord[], toDepth: (p: number) => number): ImageDepthProfile {
    const first = input.filter_first_image ?? null;
    const last = input.filter_last_image ?? null;
    const { lo, hi } = keptRange(records, first, last);

    const points = records.map((r) => ({
        image_index: r.image_index,
        image_id: r.image_id,
        depth_m: toDepth(r.raw_pressure),
        is_selected: r.image_index >= lo && r.image_index <= hi,
    }));

    return {
        points,
        filter_first_image: first,
        filter_last_image: last,
        total_images: records.length,
        selected_images: points.filter((p) => p.is_selected).length,
    };
}

function buildVolumeProfile(records: PerImageRecord[], toDepth: (p: number) => number, binCentre: (b: number) => number, image_volume_l: number): BinnedDepthProfile {
    const imgCountByBin = new Map<number, number>();
    for (const r of records) {
        const bin = Math.floor(toDepth(r.raw_pressure) / BIN_SIZE_M);
        imgCountByBin.set(bin, (imgCountByBin.get(bin) ?? 0) + 1);
    }
    const bins = [...imgCountByBin.keys()].sort((a, b) => a - b);
    return {
        bin_size_m: BIN_SIZE_M,
        suggested_scale: "linear",
        series: [
            {
                label: "imaged volume",
                unit: "L",
                points: bins.map((bin) => ({ depth_m: binCentre(bin), value: (imgCountByBin.get(bin) as number) * image_volume_l })),
            },
        ],
    };
}

function buildPixelProfile(records: PerImageRecord[], toDepth: (p: number) => number, binCentre: (b: number) => number): BinnedDepthProfile {
    // bin -> { px class -> summed count }
    const byBin = new Map<number, Record<number, number>>();
    for (const r of records) {
        const bin = Math.floor(toDepth(r.raw_pressure) / BIN_SIZE_M);
        let acc = byBin.get(bin);
        if (!acc) { acc = {}; byBin.set(bin, acc); }
        for (const px of PIXEL_CLASSES) {
            acc[px] = (acc[px] ?? 0) + (r.spectrum_counts[px] ?? 0);
        }
    }
    const bins = [...byBin.keys()].sort((a, b) => a - b);
    return {
        bin_size_m: BIN_SIZE_M,
        suggested_scale: "log",
        series: PIXEL_CLASSES.map((px) => ({
            label: `${px} px`,
            unit: "count",
            points: bins.map((bin) => ({ depth_m: binCentre(bin), value: (byBin.get(bin) as Record<number, number>)[px] ?? 0 })),
        })),
    };
}

/* Descent-filter metadata (mirrors legacy EcoPart uvp_sample_import). first_image / last_image are
 * the operator-selected bounds (header firstimage / endimg; endimg may be a sentinel). The descent
 * filter keeps an image only while depth is non-decreasing (reject when depth < the deepest kept so
 * far); last_image_used is the deepest kept image and removed_images counts the images it drops
 * within the operator's selected window [firstimage, endimg]. */
function buildImageFiltering(input: QcGraphInput, records: PerImageRecord[], toDepth: (p: number) => number): ImageFilteringMetadata {
    const first_image = input.filter_first_image ?? null;   // header firstimage
    const last_image = input.filter_last_image ?? null;     // header endimg (may be a sentinel)

    // Operator-selected window [firstimage, endimg] in acquisition order. A sentinel or unmatched
    // bound falls back to an open end (see keptRange), so this never iterates beyond the real data.
    const { lo, hi } = keptRange(records, first_image, last_image);
    const window = records.filter((r) => r.image_index >= lo && r.image_index <= hi);
    if (window.length === 0) {
        return { first_image, last_image, last_image_used: null, removed_images: { count: 0, percent: 0 } };
    }

    // The descent filter is depth-only (per Marc): for a time-series profile it does not apply, so
    // every image in the window is used and nothing is removed.
    if (!input.is_depth_profile) {
        return {
            first_image,
            last_image,
            last_image_used: window[window.length - 1].image_id,
            removed_images: { count: 0, percent: 0 },
        };
    }

    // Depth profile — descent filter: keep an image while its depth is >= the deepest kept so far.
    let deepest = -Infinity;
    let kept = 0;
    let last_used_pos = -1;
    for (let i = 0; i < window.length; i++) {
        const depth = toDepth(window[i].raw_pressure);
        if (depth >= deepest) { deepest = depth; kept++; last_used_pos = i; }
    }

    const count = window.length - kept;                       // images dropped by the descent filter
    const percent = (count / window.length) * 100;
    return {
        first_image,
        last_image,
        last_image_used: last_used_pos >= 0 ? window[last_used_pos].image_id : null,
        removed_images: { count, percent },
    };
}

// Locate the kept [lo, hi] image-index window from the filter ids. When the ids can't be matched
// (formats differ across instruments / no range set), fall back to "everything kept".
function keptRange(records: PerImageRecord[], first: string | null, last: string | null): { lo: number; hi: number } {
    const idToIndex = new Map(records.map((r) => [r.image_id, r.image_index]));
    const firstIdx = first !== null ? idToIndex.get(first) : undefined;
    const lastIdx = last !== null ? idToIndex.get(last) : undefined;
    // Each bound is independent: an unmatched firstimage opens the low end, an unmatched/sentinel
    // endimg opens the high end.
    return {
        lo: firstIdx ?? -Infinity,
        hi: lastIdx ?? Infinity,
    };
}
