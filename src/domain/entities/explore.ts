import { ProjectPrivacyLevel } from "./project";

/* Explore page: a selection of samples drawn from every project of the application, its statistics,
 * its projects and the curves of its samples. The shapes mirror the front's explore.types.ts. */

export type ExploreMode = "depth" | "time";

export type ExploreClassificationState = "all" | "fully_predicted" | "fully_validated";

export interface ExploreBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

// The criteria of the selection panel. Empty lists and nulls mean "no constraint".
export interface ExploreFilters {
    project_ids: number[];
    instrument_models: string[];
    bounds: ExploreBounds | null;
    date_from: string | null;                 // YYYY-MM-DD, inclusive
    date_to: string | null;
    months: number[];                         // 1-12, whatever the year
    sample_names: string[];                   // fragments, any of them
    hour_range: [number, number] | null;      // hours of the day, UTC (0-24)
    pressure_range: [number, number] | null;  // dbar, kept when the sample partially covers it
    privacy_statuses: ProjectPrivacyLevel[];
    my_projects: boolean;                     // also keep the projects the user is a member or manager of
    ctd_only: boolean;
    ecotaxa_imported_only: boolean;
    ecotaxa_exclude_not_living: boolean;
    classification_state: ExploreClassificationState;
}

export interface ExploreRequest {
    mode: ExploreMode;
    filters: ExploreFilters | null;
}

export interface ExploreGraphsRequest extends ExploreRequest {
    pressure_bin?: number;                    // depth step in metres (dbar), see BINNED_DEPTH_STEP_M
    time_bin?: number;                        // time step in hours, see BINNED_TIME_STEP_H
}

export interface ExploreImagesRequest extends ExploreRequest {
    count?: number;
}

/* ─── what the data source can filter ─── */

export interface ExploreSampleQuery {
    sample_type_label: "Depth" | "Time";
    project_ids: number[] | null;             // null: every project
    bounds: ExploreBounds | null;
    date_from: string | null;
    date_to: string | null;
    months: number[];
    sample_names: string[];
    hour_range: [number, number] | null;
    pressure_range: [number, number] | null;
    ctd_only: boolean;
    ecotaxa_imported_only: boolean;
}

// A light sample row: what the selection, the map, the stats and the graphs need, nothing else.
export interface ExploreSampleRow {
    sample_id: number;
    sample_name: string;
    project_id: number;
    latitude: number | null;                  // the reference position (CTD one when use_ctd_coordinates)
    longitude: number | null;
    sampling_utc_date_time: string;
    max_pressure: number | null;              // dbar
    sample_type_label: string;
    visual_qc_status_label: string;
    ctd_imported: boolean;
    ctd_file_extension: string | null;
    ecotaxa_sample_imported: boolean;
    ecotaxa_sample_id: number | null;
    nb_vignettes: number;
    nb_particles: number | null;
    particle_min_area_px: number | null;
    particle_max_area_px: number | null;
    filter_first_image: string | null;
    filter_last_image: string | null;
    instrument_settings_depth_offset_m: number | null;
    instrument_settings_image_volume_l: number;
    instrument_settings_aa: number;
    instrument_settings_exp: number;
    instrument_settings_particule_minimum_area_pixels: number | null;
}

/* ─── responses ─── */

export interface ExploreProjectOption {
    project_id: number;
    project_title: string;
    nb_samples: number;
}

export interface ExploreMapSample {
    sample_id: number;
    sample_name: string;
    project_id: number;
    project_title: string;
    latitude: number;
    longitude: number;
    instrument_model: string;
    privacy_status: ProjectPrivacyLevel;
    is_my_project: boolean;
}

export interface LabelCount {
    label: string;
    count: number;
}

export interface PressureHistogramBin {
    max_pressure: number;                     // upper edge of the bin, dbar (bins are contiguous from 0)
    nb_profiles: number;
}

export interface ProfilePoint {
    date: string;
    latitude: number;
}

export interface ExploreSummary {
    counts: { projects: number; samples: number; particles: number; images: number };
    sample_types: { depth: number; time: number; total: number };
    pressure_range: { min: number; max: number } | null;   // dbar
    size_range: { min: number; max: number } | null;       // µm (ESD)
    time_range: { start: string; end: string } | null;
    instruments: LabelCount[];
    max_pressure_histogram: PressureHistogramBin[];
    profiles: ProfilePoint[];
}

export interface ExploreContact {
    user_name: string;
    email: string;                            // "" for an anonymous caller
}

export interface ExploreProjectRow {
    project_id: number;
    project_title: string;
    instrument_model: string;
    ecotaxa_project_name: string | null;
    nb_selected_samples: number;
    nb_samples: number;
    privacy_status: ProjectPrivacyLevel;
    is_my_project: boolean;
    contact: ExploreContact | null;
    managers: ExploreContact[];
}

export interface ExploreSelection {
    summary: ExploreSummary | null;
    projects: ExploreProjectRow[];
}

export interface ExploreSelectionResponse {
    all: ExploreSelection;
    exportable: ExploreSelection;
}

export interface ClassificationShares {
    fully_validated: number;                  // percent of the samples with EcoTaxa stats
    fully_predicted: number;
    partially_validated: number;
    partially_predicted: number;
}

export interface ExploreEcoTaxaSummary {
    categories: string[];
    classification: ClassificationShares;
    nb_samples_with_stats: number;
}

export interface ExploreEcoTaxaResponse {
    all: ExploreEcoTaxaSummary;
    exportable: ExploreEcoTaxaSummary;
}

export interface ExploreImage {
    object_id: number;
    image_url: string;
    sample_name: string;
    depth: number | null;
    date: string | null;
}

export interface ProfileSeries {
    sample_id: number;
    sample_name: string;
    points: { position: number; value: number }[];   // position: depth in m, or epoch ms for a time series
}

export interface GraphDataset {
    keys: string[];
    axis_labels: Record<string, string>;
    series: Record<string, ProfileSeries[]>;
}

export interface ExploreGraphs {
    abundance: GraphDataset;
    biovolume: GraphDataset;
    ctd: GraphDataset;
    ecotaxa: GraphDataset;
    warnings: string[];
}
