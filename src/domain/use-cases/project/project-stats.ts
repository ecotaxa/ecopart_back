import { ExploreEcoTaxaSummary, ExploreSummary, StoredEcoTaxaStats } from "../../entities/explore";
import { ProjectResponseModel } from "../../entities/project";
import { ProjectQcStateModel, ProjectQcWarning, ProjectStatsEcoTaxa, ProjectStatsMap, ProjectStatsMapSample, ProjectStatsPrivacy, ProjectStatsRawBackup, ProjectStatsSampleRow, ProjectStatsSamples } from "../../entities/project-stats";
import { computeProjectPrivacy, privacyMilestones } from "../../utils/project-privacy";
import { classificationSharesOf, objectCountsOf, toSampleStat, totalOf } from "../explore/explore-ecotaxa";
import { LandMask } from "../../interfaces/geography/land-mask";

/* The pure part of a project's statistics: what each section of the STATS tab shows, and its
 * warnings, computed from the light sample rows without any further IO. */

// A CTD position further than this from the sample's own is reported as a mismatch: a wrong sign,
// swapped coordinates or another station, not a drift during the cast.
export const COORDINATES_MISMATCH_KM = 5;
// Samples dated before this year, or in the future, carry an unreadable or wrong date.
export const EARLIEST_PLAUSIBLE_SAMPLING_YEAR = 2000;
// Deeper than any UVP rating (6000 m): the pressure was misread.
export const MAX_PLAUSIBLE_PRESSURE_DBAR = 6500;
// A sample whose instrument parameters differ from the most common ones in the project was acquired
// or processed differently (another instrument, another calibration or acquisition configuration).
export const INSTRUMENT_PARAMETERS: (keyof ProjectStatsSampleRow)[] = [
    "instrument_serial_number",
    "instrument_settings_aa",
    "instrument_settings_exp",
    "instrument_settings_pixel_size_mm",
    "instrument_settings_image_volume_l",
    "instrument_settings_acq_gain",
    "instrument_settings_acq_threshold",
    "instrument_settings_acq_exposure",
];

// A position on land counts only this far from the water: the 1:10m coastline closes the narrow bays,
// straits and harbours a coastal station can sit in, never by more than a kilometre.
export const LAND_MARGIN_KM = 2;

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = EARTH_RADIUS_KM * Math.PI / 180;

const isFinite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

// Great-circle distance between two positions in decimal degrees (haversine).
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function countStations(samples: ProjectStatsSampleRow[]): number {
    const stations = new Set<string>();
    for (const sample of samples) {
        const station = sample.station_id.trim();
        if (station !== "") stations.add(station);
    }
    return stations.size;
}

// On land, and still on land LAND_MARGIN_KM away in each of eight directions.
export function isInland(land: LandMask, latitude: number, longitude: number): boolean {
    if (!land.isOnLand(latitude, longitude)) return false;
    const margin_latitude = LAND_MARGIN_KM / KM_PER_DEGREE;
    const margin_longitude = margin_latitude / Math.max(Math.cos(latitude * Math.PI / 180), 0.01);
    for (let direction = 0; direction < 8; direction++) {
        const angle = direction * Math.PI / 4;
        const probe_latitude = Math.max(-90, Math.min(90, latitude + margin_latitude * Math.cos(angle)));
        if (!land.isOnLand(probe_latitude, longitude + margin_longitude * Math.sin(angle))) return false;
    }
    return true;
}

export function buildProjectStatsMap(samples: ProjectStatsSampleRow[], land: LandMask): ProjectStatsMap {
    let nb_samples_without_ctd = 0;
    let nb_coordinates_mismatches = 0;
    let nb_samples_on_land = 0;
    const points: ProjectStatsMapSample[] = samples.map(sample => {
        if (!sample.ctd_imported) nb_samples_without_ctd++;
        const both_known = isFinite(sample.sample_latitude) && isFinite(sample.sample_longitude) && isFinite(sample.ctd_latitude) && isFinite(sample.ctd_longitude);
        const coordinates_mismatch = both_known
            && distanceKm(sample.sample_latitude as number, sample.sample_longitude as number, sample.ctd_latitude as number, sample.ctd_longitude as number) > COORDINATES_MISMATCH_KM;
        if (coordinates_mismatch) nb_coordinates_mismatches++;
        const on_land = isFinite(sample.latitude) && isFinite(sample.longitude) && isInland(land, sample.latitude, sample.longitude);
        if (on_land) nb_samples_on_land++;
        return {
            sample_id: sample.sample_id,
            sample_name: sample.sample_name,
            latitude: sample.sample_latitude,
            longitude: sample.sample_longitude,
            ctd_latitude: sample.ctd_latitude,
            ctd_longitude: sample.ctd_longitude,
            use_ctd_coordinates: sample.use_ctd_coordinates,
            coordinates_mismatch,
            on_land,
        };
    });
    return { samples: points, nb_samples_without_ctd, nb_coordinates_mismatches, nb_samples_on_land };
}

// The samples whose instrument parameters differ from the most common combination of the project.
export function countInstrumentParameterMismatches(samples: ProjectStatsSampleRow[]): number {
    const counts = new Map<string, number>();
    const keys = samples.map(sample => JSON.stringify(INSTRUMENT_PARAMETERS.map(parameter => sample[parameter] ?? null)));
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    let most_common = 0;
    for (const count of counts.values()) if (count > most_common) most_common = count;
    return samples.length - most_common;
}

export function countSuspiciousDates(samples: ProjectStatsSampleRow[], now: Date): number {
    const earliest = Date.UTC(EARLIEST_PLAUSIBLE_SAMPLING_YEAR, 0, 1);
    // A sample is dated in its own time zone at import: a day of slack before calling it future.
    const latest = now.getTime() + 24 * 60 * 60 * 1000;
    return samples.filter(sample => {
        const time = Date.parse(sample.sampling_utc_date_time);
        return !Number.isFinite(time) || time < earliest || time > latest;
    }).length;
}

export function countSuspiciousPressures(samples: ProjectStatsSampleRow[]): number {
    return samples.filter(sample => {
        if (isFinite(sample.max_pressure) && sample.max_pressure > MAX_PLAUSIBLE_PRESSURE_DBAR) return true;
        return sample.sample_type_label === "Depth" && !(isFinite(sample.max_pressure) && sample.max_pressure > 0);
    }).length;
}

export function buildProjectStatsSamples(summary: ExploreSummary | null, samples: ProjectStatsSampleRow[], now: Date): ProjectStatsSamples {
    return {
        sample_types: summary?.sample_types ?? { depth: 0, time: 0, total: 0 },
        pressure_range: summary?.pressure_range ?? null,
        size_range: summary?.size_range ?? null,
        time_range: summary?.time_range ?? null,
        max_pressure_histogram: summary?.max_pressure_histogram ?? [],
        nb_instrument_parameter_mismatches: countInstrumentParameterMismatches(samples),
        nb_suspicious_dates: countSuspiciousDates(samples, now),
        nb_suspicious_pressures: countSuspiciousPressures(samples),
    };
}

export function buildProjectStatsPrivacy(project: ProjectResponseModel, now: Date): ProjectStatsPrivacy {
    const milestones = privacyMilestones(project.oldest_sample_utc_date_time, project.privacy_duration, project.visible_duration, project.public_duration);
    return {
        status: computeProjectPrivacy(project.oldest_sample_utc_date_time, project.privacy_duration, project.visible_duration, project.public_duration, now),
        oldest_sample_utc_date_time: project.oldest_sample_utc_date_time,
        visible_utc_date_time: milestones.visible,
        public_utc_date_time: milestones.public,
        open_utc_date_time: milestones.open,
    };
}

// The samples imported since the last raw backup are not in it; without any backup, none is.
export function buildProjectStatsRawBackup(project: ProjectResponseModel, samples: ProjectStatsSampleRow[]): ProjectStatsRawBackup {
    const last_backup_utc_date_time = project.last_backup_utc_date_time ?? null;
    const backed_up_until = last_backup_utc_date_time ? Date.parse(last_backup_utc_date_time) : NaN;
    const nb_samples_not_backed_up = Number.isFinite(backed_up_until)
        ? samples.filter(sample => {
            const imported = sample.sample_creation_utc_date_time ? Date.parse(sample.sample_creation_utc_date_time) : NaN;
            return !Number.isFinite(imported) || imported > backed_up_until;
        }).length
        : samples.length;
    return { last_backup_utc_date_time, nb_samples_not_backed_up };
}

export const EMPTY_ECOTAXA_SUMMARY: ExploreEcoTaxaSummary = {
    categories: [],
    classification: { fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
    objects: { total: 0, validated: 0, predicted: 0 },
    nb_samples_with_stats: 0,
    partial: false,
    nb_samples_pending: 0,
};

export function buildProjectStatsEcoTaxa(summary: ExploreEcoTaxaSummary, samples: ProjectStatsSampleRow[], linked: boolean): ProjectStatsEcoTaxa {
    const nb_imported = samples.filter(sample => sample.ecotaxa_sample_imported).length;
    // Complete once every imported sample has its stats and every object of theirs is validated.
    const classification_completed = linked && nb_imported > 0 && !summary.partial
        && summary.nb_samples_with_stats === nb_imported
        && summary.objects.total > 0 && summary.objects.validated === summary.objects.total;
    return {
        linked,
        categories: summary.categories,
        classification: summary.classification,
        objects: summary.objects,
        nb_samples_with_stats: summary.nb_samples_with_stats,
        partial: summary.partial,
        nb_samples_pending: summary.nb_samples_pending,
        nb_samples_not_imported: samples.length - nb_imported,
        classification_completed,
    };
}

// What the warnings of the STATS tab are read from: a full statistics response, or only its counts.
export interface ProjectQcInputs {
    raw_backup: Pick<ProjectStatsRawBackup, "nb_samples_not_backed_up"> | null;
    map: Pick<ProjectStatsMap, "nb_samples_without_ctd" | "nb_coordinates_mismatches" | "nb_samples_on_land">;
    samples: Pick<ProjectStatsSamples, "nb_instrument_parameter_mismatches" | "nb_suspicious_dates" | "nb_suspicious_pressures">;
    ecotaxa: Pick<ProjectStatsEcoTaxa, "linked" | "nb_samples_not_imported" | "classification_completed">;
}

// The warnings the STATS tab shows, section by section, under the same conditions: the raw backup
// one only when the backup state is shown, the EcoTaxa ones only for a linked project.
export function buildProjectQcWarnings(stats: ProjectQcInputs): ProjectQcWarning[] {
    const warnings: ProjectQcWarning[] = [];
    if (stats.raw_backup && stats.raw_backup.nb_samples_not_backed_up > 0) warnings.push({ code: "samples_not_backed_up", nb_samples: stats.raw_backup.nb_samples_not_backed_up });
    if (stats.map.nb_samples_without_ctd > 0) warnings.push({ code: "samples_without_ctd", nb_samples: stats.map.nb_samples_without_ctd });
    if (stats.map.nb_coordinates_mismatches > 0) warnings.push({ code: "coordinates_mismatches", nb_samples: stats.map.nb_coordinates_mismatches });
    if (stats.map.nb_samples_on_land > 0) warnings.push({ code: "samples_on_land", nb_samples: stats.map.nb_samples_on_land });
    if (stats.samples.nb_instrument_parameter_mismatches > 0) warnings.push({ code: "instrument_parameter_mismatches", nb_samples: stats.samples.nb_instrument_parameter_mismatches });
    if (stats.samples.nb_suspicious_dates > 0) warnings.push({ code: "suspicious_dates", nb_samples: stats.samples.nb_suspicious_dates });
    if (stats.samples.nb_suspicious_pressures > 0) warnings.push({ code: "suspicious_pressures", nb_samples: stats.samples.nb_suspicious_pressures });
    if (stats.ecotaxa.linked) {
        if (stats.ecotaxa.nb_samples_not_imported > 0) warnings.push({ code: "samples_not_imported_in_ecotaxa", nb_samples: stats.ecotaxa.nb_samples_not_imported });
        if (!stats.ecotaxa.classification_completed) warnings.push({ code: "classification_uncompleted", nb_samples: null });
    }
    return warnings;
}

// The EcoTaxa summary as EcoPart last stored it, without asking EcoTaxa: a sample imported there
// whose stats were never read counts as pending, so the classification is not reported complete.
export function storedEcoTaxaSummary(samples: ProjectStatsSampleRow[], stored: StoredEcoTaxaStats[]): ExploreEcoTaxaSummary {
    const by_sample = new Map(stored.map(row => [row.sample_id, row]));
    const stats = [];
    let pending = 0;
    for (const sample of samples) {
        if (!sample.ecotaxa_sample_imported) continue;
        const row = by_sample.get(sample.sample_id);
        if (row) stats.push(toSampleStat(row));
        else pending++;
    }
    return {
        categories: [],
        classification: classificationSharesOf(stats),
        objects: objectCountsOf(stats),
        nb_samples_with_stats: stats.filter(stat => totalOf(stat) > 0).length,
        partial: pending > 0,
        nb_samples_pending: pending,
    };
}

// The QC state of a project in the project lists: the warnings of its STATS tab, from the same
// rows, with the EcoTaxa classification as last stored.
export function buildProjectQcState(project: ProjectResponseModel, samples: ProjectStatsSampleRow[], stored: StoredEcoTaxaStats[], with_raw_backup: boolean, land: LandMask, now: Date): ProjectQcStateModel {
    if (samples.length === 0) return { project_id: project.project_id, qc_state: "empty", warnings: [] };
    const linked = project.ecotaxa_project_id !== null && project.ecotaxa_instance_id !== null;
    const warnings = buildProjectQcWarnings({
        raw_backup: with_raw_backup ? buildProjectStatsRawBackup(project, samples) : null,
        map: buildProjectStatsMap(samples, land),
        samples: {
            nb_instrument_parameter_mismatches: countInstrumentParameterMismatches(samples),
            nb_suspicious_dates: countSuspiciousDates(samples, now),
            nb_suspicious_pressures: countSuspiciousPressures(samples),
        },
        ecotaxa: buildProjectStatsEcoTaxa(storedEcoTaxaSummary(samples, stored), samples, linked),
    });
    return { project_id: project.project_id, qc_state: warnings.length > 0 ? "warning" : "ok", warnings };
}
