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
}

export interface ProjectStatsMap {
    samples: ProjectStatsMapSample[];
    nb_samples_without_ctd: number;
    nb_coordinates_mismatches: number;
}

export interface ProjectStatsSamples {
    sample_types: { depth: number; time: number; total: number };
    pressure_range: { min: number; max: number } | null;   // dbar
    size_range: { min: number; max: number } | null;       // µm (ESD)
    time_range: { start: string; end: string } | null;
    max_pressure_histogram: PressureHistogramBin[];
    nb_instrument_parameter_mismatches: number;   // samples whose instrument parameters differ from the most common ones
    nb_suspicious_dates: number;                  // sampled before 2000, in the future, or with an unreadable date
    nb_suspicious_pressures: number;              // depth samples without a positive max pressure, samples deeper than the instrument rating
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
    classification_completed: boolean;        // every sample imported in EcoTaxa has its stats and is fully validated
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
