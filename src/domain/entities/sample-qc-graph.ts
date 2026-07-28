/* SAMPLE IMPORT QC GRAPHS
 *
 * Data for the three vertical-profile graphs shown at import-validation time, for every
 * instrument (UVP5 / UVP6). The Y axis of every graph is DEPTH in metres, derived from the
 * raw pressure as `depth_m = raw_pressure * gain + depth_offset` (gain: UVP5 = 0.1, UVP6 = 1;
 * offset = sample.instrument_settings_depth_offset_m). depth_m ≈ pressure in dbar, so it
 * serves the "vs pressure" graph titles, and it matches the legacy EcoPart product.
 *
 * Graph 3 is the legacy "raw histogram" (GenerateRawHistogramUVPAPP): particles split by the
 * flash/light flag — ON = real particles (particle_lpm_profile), OFF = black/noise
 * (black_profile) — keyed by raw pixel area (classes 1, 2, 3 px).
 */

// Rendering hint for the value (X) axis — answers the "simlog" question. Frontend may override.
export type AxisScale = "linear" | "log";

/* Graph 1 — depth of each image (one point per image, NOT binned) */
export interface ImageDepthPoint {
    image_index: number;     // order of the image/frame in the raw file (0-based)
    image_id: string;        // raw id (UVP6 "20240612-003906-1" / UVP5 datfile frame index)
    depth_m: number;         // metres
    is_selected: boolean;    // within the kept [filter_first_image .. filter_last_image] range
}

export interface ImageDepthProfile {
    points: ImageDepthPoint[];
    filter_first_image: string | null;   // sample.filter_first_image
    filter_last_image: string | null;    // sample.filter_last_image
    total_images: number;
    selected_images: number;
}

/* Graphs 2 & 3 — generic vertical profile binned by depth (legacy raw-histogram bin = 1 m) */
export interface DepthBinPoint {
    depth_m: number;         // bin centre (floor(depth) + bin_size/2)
    value: number;           // series value in this bin
}

export interface DepthProfileSeries {
    label: string;           // "imaged volume" | "1 px" | "2 px" | "3 px"
    unit: string;            // "L" | "count"
    points: DepthBinPoint[];
}

export interface BinnedDepthProfile {
    bin_size_m: number;                  // metres per bin (default 1, matching legacy)
    suggested_scale: AxisScale;          // "log" for counts, "linear" for volume
    series: DepthProfileSeries[];        // 1 series (volume) or 3 series (1/2/3 px)
}

/* Image-selection / descent-filter stats shown alongside every QC response (pre- and post-import).
 * Definitions per Marc:
 *  - first_image / last_image: the operator-selected sample bounds = header firstimage / endimg
 *    (the values chosen in Zooprocess / UVP app to cut the sample out of the sequence). endimg is
 *    frequently a "to the end" sentinel (e.g. 99999999999), reported verbatim.
 *  - The descent filter (depth-only, mirrors legacy EcoPart) keeps only images taken while the
 *    instrument is descending. last_image_used is the deepest image it keeps; removed_images counts
 *    the images it drops within the selected window (count + percentage). */
export interface ImageFilteringMetadata {
    first_image: string | null;          // header firstimage — operator-selected sample start
    last_image: string | null;           // header endimg — operator-selected sample end (may be a sentinel)
    last_image_used: string | null;      // deepest image kept by the descent filter
    removed_images: { count: number; percent: number }; // images the descent filter drops within the window
}

/* Top-level payload returned for one sample */
export interface SampleQcGraphsResponseModel {
    sample_id: number | null;            // null for a pre-import preview (sample not yet created)
    sample_name: string;
    instrument_model: string;            // "UVP6…" / "UVP5…"
    depth_unit: "m";
    visual_qc_status_label: string;      // PENDING / VALIDATED / REJECTED, or "NOT_IMPORTED" for a preview

    image_depth_profile: ImageDepthProfile;      // graph 1
    imaged_volume_profile: BinnedDepthProfile;   // graph 2 (1 series, unit "L")
    particle_lpm_profile: BinnedDepthProfile;    // graph 3 — flash/light ON, 3 series 1/2/3 px
    black_profile: BinnedDepthProfile | null;    // graph 3 — flash/light OFF, 3 series; null when no dark frames (typically UVP5)
    image_filtering: ImageFilteringMetadata;     // image-selection / filtering stats
}

/* Source-derived QC metadata read directly from the project source folder for a not-yet-imported
 * sample (used by the pre-import preview). Mirrors the post-import sample fields the builder needs. */
export interface SampleSourceQcMetadata {
    filter_first_image: string | null;
    filter_last_image: string | null;
    instrument_settings_image_volume_l: number | null;
    instrument_settings_depth_offset_m: number | null;
    sample_type_label: string | null;   // "Depth" | "Time" (from the raw sample-type letter); null if unknown
}

/* Repository IO shape — one record per acquired image/frame, extracted from the raw files.
 * Binning into the profiles above is domain logic done in the use case. */
export interface PerImageRecord {
    image_index: number;                 // frame order (0-based)
    image_id: string;                    // raw id
    raw_pressure: number;                // pre-gain value read from the file
    light_on: boolean;                   // flash/light flag: ON = particles, OFF = black
    spectrum_counts: Record<number, number>;  // pixel-area (px) -> particle count (sparse; absent = 0)
}
