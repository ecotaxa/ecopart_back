import { ClassificationShares, ExploreSampleRow, PressureHistogramBin } from "./explore";
import { ProjectPrivacyLevel } from "./project";

/* The statistics of one project (its STATS tab): headline counts, privacy timeline, raw backup,
 * sample positions, sample types and ranges, EcoTaxa classification, each with its warnings. */

// The light sample row the project statistics read: the Explore one, plus what the map, the raw
// backup and the instrument-parameter check need. `latitude` / `longitude` stay the reference
// position (the CTD one when the sample uses it); `sample_*` is the position of the sample metadata.
export interface ProjectStatsSampleRow extends ExploreSampleRow {
    station_id: string;
    sample_latitude: number | null;
    sample_longitude: number | null;
    ctd_latitude: number | null;
    ctd_longitude: number | null;
    use_ctd_coordinates: boolean;
    sample_creation_utc_date_time: string | null;
    instrument_serial_number: string;
    instrument_settings_pixel_size_mm: number | null;
    instrument_settings_acq_gain: number | null;
    instrument_settings_acq_threshold: number | null;
    instrument_settings_acq_exposure: number | null;
}

export interface ProjectStatsCounts {
    stations: number;                         // distinct station ids
    samples: number;
    particles: number;                        // sum of the samples' particle counts, unknown counts as 0
    vignettes: number;                        // sum of the samples' vignette counts
    exports: number;                          // export tasks of the project (EXPORT, EXPORT_BACKUP, EXPORT_RAW), whatever their status
}

// The privacy timeline: the dates the project becomes visible, public and open, counted in months
// from its oldest sample; all null while the project has no sample.
export interface ProjectStatsPrivacy {
    status: ProjectPrivacyLevel;
    oldest_sample_utc_date_time: string | null;
    visible_utc_date_time: string | null;
    public_utc_date_time: string | null;
    open_utc_date_time: string | null;
}

export interface ProjectStatsRawBackup {
    last_backup_utc_date_time: string | null;
    nb_samples_not_backed_up: number;         // imported after the last backup; every sample when there was none
}

export interface ProjectStatsMapSample {
    sample_id: number;
    sample_name: string;
    latitude: number | null;                  // the position of the sample metadata
    longitude: number | null;
    ctd_latitude: number | null;              // the position read from the CTD file, when it has one
    ctd_longitude: number | null;
    use_ctd_coordinates: boolean;             // which of the two the project uses as the sample position
    coordinates_mismatch: boolean;            // both known and more than COORDINATES_MISMATCH_KM apart
    on_land: boolean;                         // the position used is on land, more than LAND_MARGIN_KM from the sea or a lake
}

export interface ProjectStatsMap {
    samples: ProjectStatsMapSample[];
    nb_samples_without_ctd: number;
    nb_coordinates_mismatches: number;
    nb_samples_on_land: number;
}

export interface ProjectStatsSamples {
    sample_types: { depth: number; time: number; total: number };
    pressure_range: { min: number; max: number } | null;   // dbar
    size_range: { min: number; max: number } | null;       // µm (ESD)
    time_range: { start: string; end: string } | null;
    max_pressure_histogram: PressureHistogramBin[];
    nb_instrument_parameter_mismatches: number;   // samples whose instrument parameters differ from the most common ones
    nb_object_size_mismatches: number;            // samples with objects outside the size classes of the instrument
    nb_suspicious_dates: number;                  // sampled before 2008, in the future, or with an unreadable date
    time_span_over_a_year: boolean;               // the samples span more than a year, while the project checks it
    nb_suspicious_pressures: number;              // min pressure below -5 dbar, max above the instrument rating, depth samples without a positive max
    unfiltered_uvp5hd: boolean;                   // a UVP5HD project whose data were not declared filtered
}

export interface ProjectStatsEcoTaxa {
    linked: boolean;                          // the project is linked to an EcoTaxa project
    categories: string[];
    classification: ClassificationShares;
    objects: { total: number; validated: number; predicted: number };
    nb_samples_with_stats: number;
    partial: boolean;                         // some samples have no stats yet: they are being read from EcoTaxa, ask again later
    nb_samples_pending: number;
    nb_samples_not_imported: number;          // samples of the project not imported in EcoTaxa
    classification_completed: boolean;        // every sample imported in EcoTaxa has its stats and every object of theirs is validated or predicted
}

export interface ProjectStatsResponseModel {
    project_id: number;
    generated_at: string;
    counts: ProjectStatsCounts;
    privacy: ProjectStatsPrivacy;
    raw_backup: ProjectStatsRawBackup | null; // null for a user without privilege on the project
    map: ProjectStatsMap;
    samples: ProjectStatsSamples;
    ecotaxa: ProjectStatsEcoTaxa;
}

// The warnings of the STATS tab, one per kind; `nb_samples` is how many samples it concerns, null
// for the classification, which concerns the objects.
export type ProjectQcWarningCode =
    | "samples_not_backed_up"
    | "samples_without_ctd"
    | "coordinates_mismatches"
    | "samples_on_land"
    | "instrument_parameter_mismatches"
    | "object_size_mismatches"
    | "suspicious_dates"
    | "time_span_over_a_year"
    | "suspicious_pressures"
    | "unfiltered_uvp5hd"
    | "ecotaxa_not_linked"
    | "samples_not_imported_in_ecotaxa"
    | "classification_uncompleted";

export interface ProjectQcWarning {
    code: ProjectQcWarningCode;
    nb_samples: number | null;
}

// The QC state of a project in the project lists: "empty" without any sample, "ok" without any
// warning of its STATS tab, "warning" otherwise.
export type ProjectQcStateLabel = "empty" | "ok" | "warning";

export interface ProjectQcStateModel {
    project_id: number;
    qc_state: ProjectQcStateLabel;
    warnings: ProjectQcWarning[];
}
