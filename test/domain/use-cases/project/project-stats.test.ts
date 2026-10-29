import { ExploreSummary } from "../../../../src/domain/entities/explore";
import {
    buildProjectStatsEcoTaxa,
    buildProjectStatsMap,
    buildProjectStatsPrivacy,
    buildProjectStatsRawBackup,
    buildProjectStatsSamples,
    COORDINATES_MISMATCH_KM,
    countInstrumentParameterMismatches,
    countStations,
    countObjectSizeMismatches,
    countSuspiciousDates,
    countSuspiciousPressures,
    distanceKm,
    EMPTY_ECOTAXA_SUMMARY,
    isInland,
    isTimeSpanOverAYear,
    LAND_MARGIN_KM,
    MAX_PLAUSIBLE_PRESSURE_DBAR,
    MIN_PLAUSIBLE_PRESSURE_DBAR,
} from "../../../../src/domain/use-cases/project/project-stats";
import { LandMask } from "../../../../src/domain/interfaces/geography/land-mask";
import { exploreProject, projectStatsSample } from "../explore/explore-fixtures";

const NOW = new Date("2026-10-23T12:00:00Z");
const SEA: LandMask = { isOnLand: () => false };
// A round island 20 km across, centred on 45°N 5°E.
const ISLAND: LandMask = { isOnLand: (latitude, longitude) => distanceKm(latitude, longitude, 45, 5) < 10 };
const KM_PER_DEGREE_LATITUDE = 111.19;

describe("Project statistics builders", () => {
    describe("distanceKm", () => {
        test("Villefranche to Nice is about 8 km, a point to itself 0", () => {
            expect(distanceKm(43.704, 7.311, 43.695, 7.265)).toBeCloseTo(3.8, 0);
            expect(distanceKm(43.4, 7.87, 43.4, 7.87)).toBe(0);
            expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.2, 0);
        });
    });

    describe("countStations", () => {
        test("distinct station ids, blanks left out", () => {
            expect(countStations([
                projectStatsSample({ station_id: "st_001" }),
                projectStatsSample({ station_id: "st_001" }),
                projectStatsSample({ station_id: "st_002 " }),
                projectStatsSample({ station_id: "  " }),
            ])).toBe(2);
            expect(countStations([])).toBe(0);
        });
    });

    describe("buildProjectStatsMap", () => {
        test("one point per sample with both positions, the CTD gaps and the mismatches counted", () => {
            const map = buildProjectStatsMap([
                projectStatsSample({ sample_id: 1, sample_name: "a", ctd_imported: true, ctd_latitude: 43.41, ctd_longitude: 7.88, use_ctd_coordinates: true }),
                // The CTD cast is 100 km away.
                projectStatsSample({ sample_id: 2, sample_name: "b", ctd_imported: true, ctd_latitude: 44.3, ctd_longitude: 7.87 }),
                projectStatsSample({ sample_id: 3, sample_name: "c", ctd_imported: false }),
                projectStatsSample({ sample_id: 4, sample_name: "d", sample_latitude: null, sample_longitude: null, ctd_imported: true, ctd_latitude: 10, ctd_longitude: 10 }),
            ], SEA);

            expect(map.nb_samples_without_ctd).toBe(1);
            expect(map.nb_coordinates_mismatches).toBe(1);
            expect(map.samples).toEqual([
                { sample_id: 1, sample_name: "a", latitude: 43.4, longitude: 7.87, ctd_latitude: 43.41, ctd_longitude: 7.88, use_ctd_coordinates: true, coordinates_mismatch: false, on_land: false },
                { sample_id: 2, sample_name: "b", latitude: 43.4, longitude: 7.87, ctd_latitude: 44.3, ctd_longitude: 7.87, use_ctd_coordinates: false, coordinates_mismatch: true, on_land: false },
                { sample_id: 3, sample_name: "c", latitude: 43.4, longitude: 7.87, ctd_latitude: null, ctd_longitude: null, use_ctd_coordinates: false, coordinates_mismatch: false, on_land: false },
                { sample_id: 4, sample_name: "d", latitude: null, longitude: null, ctd_latitude: 10, ctd_longitude: 10, use_ctd_coordinates: false, coordinates_mismatch: false, on_land: false },
            ]);
        });

        test("a mismatch starts beyond the threshold", () => {
            const km_per_degree_lat = 111.19;
            const near = projectStatsSample({ ctd_latitude: 43.4 + (COORDINATES_MISMATCH_KM - 0.5) / km_per_degree_lat, ctd_longitude: 7.87 });
            const far = projectStatsSample({ ctd_latitude: 43.4 + (COORDINATES_MISMATCH_KM + 0.5) / km_per_degree_lat, ctd_longitude: 7.87 });
            expect(buildProjectStatsMap([near], SEA).nb_coordinates_mismatches).toBe(0);
            expect(buildProjectStatsMap([far], SEA).nb_coordinates_mismatches).toBe(1);
        });

        test("counts the samples whose position used is inland, an unknown position never is", () => {
            const map = buildProjectStatsMap([
                projectStatsSample({ sample_id: 1, latitude: 45, longitude: 5 }),
                projectStatsSample({ sample_id: 2, latitude: 43.4, longitude: 7.87 }),
                // The CTD position is used: the sample metadata one, at sea, is not read.
                projectStatsSample({ sample_id: 3, latitude: 45, longitude: 5, use_ctd_coordinates: true, ctd_latitude: 45, ctd_longitude: 5 }),
                projectStatsSample({ sample_id: 4, latitude: null, longitude: null }),
            ], ISLAND);

            expect(map.nb_samples_on_land).toBe(2);
            expect(map.samples.map(sample => sample.on_land)).toEqual([true, false, true, false]);
        });
    });

    describe("isInland", () => {
        test("on land and further than the margin from the sea in every direction", () => {
            expect(isInland(ISLAND, 45, 5)).toBe(true);
            expect(isInland(ISLAND, 45 + (10 - LAND_MARGIN_KM - 0.5) / KM_PER_DEGREE_LATITUDE, 5)).toBe(true);
        });

        test("a coastal position within the margin, or one at sea, is not", () => {
            expect(isInland(ISLAND, 45 + (10 - LAND_MARGIN_KM + 0.5) / KM_PER_DEGREE_LATITUDE, 5)).toBe(false);
            expect(isInland(ISLAND, 45, 5 + 12 / (KM_PER_DEGREE_LATITUDE * Math.cos(45 * Math.PI / 180)))).toBe(false);
        });

        test("stops at the first position at sea", () => {
            const land = { isOnLand: jest.fn(() => false) };
            expect(isInland(land, 45, 5)).toBe(false);
            expect(land.isOnLand).toBeCalledTimes(1);
        });

        test("the probes stay within the poles", () => {
            const land = { isOnLand: jest.fn(() => true) };
            expect(isInland(land, -89.99, 0)).toBe(true);
            for (const [latitude] of land.isOnLand.mock.calls as unknown as [number, number][]) expect(Math.abs(latitude)).toBeLessThanOrEqual(90);
        });
    });

    describe("countInstrumentParameterMismatches", () => {
        test("the samples outside the most common combination", () => {
            expect(countInstrumentParameterMismatches([
                projectStatsSample(),
                projectStatsSample(),
                projectStatsSample({ instrument_settings_aa: 2400 }),
                projectStatsSample({ instrument_serial_number: "000009LP" }),
            ])).toBe(2);
        });

        test("identical parameters, or no sample: none", () => {
            expect(countInstrumentParameterMismatches([projectStatsSample(), projectStatsSample()])).toBe(0);
            expect(countInstrumentParameterMismatches([])).toBe(0);
        });

        test("a null parameter on every sample is not a mismatch", () => {
            expect(countInstrumentParameterMismatches([
                projectStatsSample({ instrument_settings_acq_exposure: null }),
                projectStatsSample({ instrument_settings_acq_exposure: null }),
            ])).toBe(0);
        });
    });

    describe("countSuspiciousDates", () => {
        test("before 2008, in the future, or unreadable", () => {
            expect(countSuspiciousDates([
                projectStatsSample({ sampling_utc_date_time: "1997-05-02T00:00:00Z" }),
                projectStatsSample({ sampling_utc_date_time: "2007-12-31T23:59:59Z" }),
                projectStatsSample({ sampling_utc_date_time: "2008-01-01T00:00:00Z" }),
                projectStatsSample({ sampling_utc_date_time: "2026-10-26T00:00:00Z" }),
                projectStatsSample({ sampling_utc_date_time: "not a date" }),
                projectStatsSample({ sampling_utc_date_time: "2024-06-12T10:20:00Z" }),
                // Dated in the local time of the operator: a day of slack.
                projectStatsSample({ sampling_utc_date_time: "2026-10-24T08:00:00Z" }),
            ], NOW)).toBe(4);
        });
    });

    describe("isTimeSpanOverAYear", () => {
        test("the readable dates span more than a year", () => {
            const first = projectStatsSample({ sampling_utc_date_time: "2024-06-12T10:20:00Z" });
            expect(isTimeSpanOverAYear([first, projectStatsSample({ sampling_utc_date_time: "2025-06-12T10:20:00Z" })])).toBe(false);
            expect(isTimeSpanOverAYear([first, projectStatsSample({ sampling_utc_date_time: "2025-06-13T10:20:00Z" })])).toBe(true);
            expect(isTimeSpanOverAYear([first, projectStatsSample({ sampling_utc_date_time: "not a date" })])).toBe(false);
            expect(isTimeSpanOverAYear([])).toBe(false);
        });
    });

    describe("countSuspiciousPressures", () => {
        test("depth samples without a positive pressure, any sample deeper than the rating or starting above the surface", () => {
            expect(countSuspiciousPressures([
                projectStatsSample({ max_pressure: null }),
                projectStatsSample({ max_pressure: 0 }),
                projectStatsSample({ max_pressure: MAX_PLAUSIBLE_PRESSURE_DBAR + 1 }),
                projectStatsSample({ max_pressure: 3056 }),
                projectStatsSample({ sample_type_label: "Time", max_pressure: null }),
                projectStatsSample({ sample_type_label: "Time", max_pressure: 7000 }),
                projectStatsSample({ min_pressure: MIN_PLAUSIBLE_PRESSURE_DBAR - 0.1 }),
                projectStatsSample({ min_pressure: MIN_PLAUSIBLE_PRESSURE_DBAR }),
                projectStatsSample({ min_pressure: null }),
                projectStatsSample({ sample_type_label: "Time", max_pressure: null, min_pressure: -12 }),
            ])).toBe(6);
        });
    });

    describe("countObjectSizeMismatches", () => {
        test("the samples whose objects fall outside the size classes of the instrument", () => {
            expect(countObjectSizeMismatches([
                projectStatsSample(),
                // 1 px with a tiny Aa: an object of about 1 µm, under the first UVP6 class (50.8 µm).
                projectStatsSample({ instrument_settings_aa: 1 }),
                // An object of about 28 mm, over the last class (26 mm).
                projectStatsSample({ particle_max_area_px: 60000 }),
                projectStatsSample({ particle_min_area_px: null }),
                projectStatsSample({ instrument_settings_exp: 0 }),
            ], "UVP6LP")).toBe(2);
        });

        test("a model without size classes is not checked", () => {
            expect(countObjectSizeMismatches([projectStatsSample({ instrument_settings_aa: 1 })], "UVP6MHP")).toBe(0);
            expect(countObjectSizeMismatches([projectStatsSample({ instrument_settings_aa: 1 })], "CPICS")).toBe(0);
        });

        test("each model has its own first class", () => {
            // About 70 µm: in the UVP5HD classes (from 50.8 µm), under the UVP5SD ones (from 102 µm).
            const sample = projectStatsSample({ instrument_settings_aa: 0.0026, instrument_settings_exp: 1.2284, particle_min_area_px: 1.5, particle_max_area_px: 100 });
            expect(countObjectSizeMismatches([sample], "UVP5HD")).toBe(0);
            expect(countObjectSizeMismatches([sample], "UVP5SD")).toBe(1);
        });
    });

    describe("buildProjectStatsSamples", () => {
        const summary: ExploreSummary = {
            counts: { projects: 1, samples: 2, particles: 10, images: 5 },
            sample_types: { depth: 2, time: 0, total: 2 },
            pressure_range: { min: 0, max: 512.4 },
            size_range: { min: 42, max: 81000 },
            time_range: { start: "2024-06-12T10:20:00.000Z", end: "2024-06-13T10:20:00.000Z" },
            instruments: [{ label: "UVP6LP", count: 2 }],
            max_pressure_histogram: [{ max_pressure: 100, nb_profiles: 0 }],
            profiles: [],
        };

        test("takes the ranges of the summary and adds the warnings of the section", () => {
            const samples = [projectStatsSample(), projectStatsSample({ max_pressure: null, instrument_settings_aa: 1, sampling_utc_date_time: "2022-01-01T00:00:00Z" })];
            expect(buildProjectStatsSamples(summary, samples, exploreProject(5, "open"), NOW)).toEqual({
                sample_types: { depth: 2, time: 0, total: 2 },
                pressure_range: { min: 0, max: 512.4 },
                size_range: { min: 42, max: 81000 },
                time_range: { start: "2024-06-12T10:20:00.000Z", end: "2024-06-13T10:20:00.000Z" },
                max_pressure_histogram: [{ max_pressure: 100, nb_profiles: 0 }],
                nb_instrument_parameter_mismatches: 1,
                nb_object_size_mismatches: 1,
                nb_suspicious_dates: 0,
                time_span_over_a_year: true,
                nb_suspicious_pressures: 1,
                unfiltered_uvp5hd: false,
            });
        });

        test("the time duration check is the project's to disable, the filtering is asked of a UVP5HD project", () => {
            const samples = [projectStatsSample(), projectStatsSample({ sampling_utc_date_time: "2022-01-01T00:00:00Z" })];
            expect(buildProjectStatsSamples(summary, samples, exploreProject(5, "open", { time_duration_check: false }), NOW).time_span_over_a_year).toBe(false);
            expect(buildProjectStatsSamples(summary, samples, exploreProject(5, "open", { instrument_model: "UVP5HD" }), NOW).unfiltered_uvp5hd).toBe(true);
            expect(buildProjectStatsSamples(summary, samples, exploreProject(5, "open", { instrument_model: "UVP5HD", filtered_project: true }), NOW).unfiltered_uvp5hd).toBe(false);
            expect(buildProjectStatsSamples(summary, samples, exploreProject(5, "open", { instrument_model: "UVP5SD" }), NOW).unfiltered_uvp5hd).toBe(false);
        });

        test("without any sample: empty ranges and no warning", () => {
            expect(buildProjectStatsSamples(null, [], exploreProject(5, "open"), NOW)).toEqual({
                sample_types: { depth: 0, time: 0, total: 0 },
                pressure_range: null,
                size_range: null,
                time_range: null,
                max_pressure_histogram: [],
                nb_instrument_parameter_mismatches: 0,
                nb_object_size_mismatches: 0,
                nb_suspicious_dates: 0,
                time_span_over_a_year: false,
                nb_suspicious_pressures: 0,
                unfiltered_uvp5hd: false,
            });
        });
    });

    describe("buildProjectStatsPrivacy", () => {
        test("the status today and the dates of the next levels", () => {
            const project = exploreProject(1, "open", { oldest_sample_utc_date_time: "2021-05-05T10:00:00Z", privacy_duration: 2, visible_duration: 22, public_duration: 12 });
            expect(buildProjectStatsPrivacy(project, NOW)).toEqual({
                status: "open",
                oldest_sample_utc_date_time: "2021-05-05T10:00:00Z",
                visible_utc_date_time: "2021-07-05T00:00:00.000Z",
                public_utc_date_time: "2023-05-05T00:00:00.000Z",
                open_utc_date_time: "2024-05-05T00:00:00.000Z",
            });
        });

        test("a project without sample is private, without any date", () => {
            const project = exploreProject(1, "open", { oldest_sample_utc_date_time: null });
            expect(buildProjectStatsPrivacy(project, NOW)).toEqual({
                status: "private",
                oldest_sample_utc_date_time: null,
                visible_utc_date_time: null,
                public_utc_date_time: null,
                open_utc_date_time: null,
            });
        });
    });

    describe("buildProjectStatsRawBackup", () => {
        test("the samples imported after the last backup are not in it", () => {
            const project = exploreProject(1, "open", { last_backup_utc_date_time: "2024-07-10T00:00:00.000Z" });
            expect(buildProjectStatsRawBackup(project, [
                projectStatsSample({ sample_creation_utc_date_time: "2024-07-01T09:00:00.000Z" }),
                projectStatsSample({ sample_creation_utc_date_time: "2024-07-10T00:00:00.000Z" }),
                projectStatsSample({ sample_creation_utc_date_time: "2024-07-11T09:00:00.000Z" }),
                projectStatsSample({ sample_creation_utc_date_time: null }),
            ])).toEqual({ last_backup_utc_date_time: "2024-07-10T00:00:00.000Z", nb_samples_not_backed_up: 2 });
        });

        test("never backed up: every sample", () => {
            const project = exploreProject(1, "open", { last_backup_utc_date_time: null });
            expect(buildProjectStatsRawBackup(project, [projectStatsSample(), projectStatsSample()])).toEqual({ last_backup_utc_date_time: null, nb_samples_not_backed_up: 2 });
        });
    });

    describe("buildProjectStatsEcoTaxa", () => {
        const summary = {
            categories: ["Copepoda"],
            classification: { fully_validated: 100, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
            objects: { total: 30, validated: 30, predicted: 0 },
            nb_samples_with_stats: 2,
            partial: false,
            nb_samples_pending: 0,
        };
        const imported = () => projectStatsSample({ ecotaxa_sample_imported: true, ecotaxa_sample_id: 9001 });

        test("complete when every imported sample has its stats and only validated or predicted objects", () => {
            expect(buildProjectStatsEcoTaxa(summary, [imported(), imported(), projectStatsSample()], true)).toEqual({
                linked: true,
                ...summary,
                nb_samples_not_imported: 1,
                classification_completed: true,
            });
            const predicted = { ...summary, objects: { total: 30, validated: 20, predicted: 10 } };
            expect(buildProjectStatsEcoTaxa(predicted, [imported(), imported()], true).classification_completed).toBe(true);
        });

        test.each([
            ["an object is dubious or unclassified", { ...summary, objects: { total: 30, validated: 28, predicted: 1 } }, [imported(), imported()]],
            ["a sample has no stats yet", { ...summary, nb_samples_with_stats: 1 }, [imported(), imported()]],
            ["the stats are partial", { ...summary, partial: true, nb_samples_pending: 1 }, [imported(), imported()]],
            ["no sample is imported", summary, [projectStatsSample()]],
        ])("not complete when %s", (_reason, given, samples) => {
            expect(buildProjectStatsEcoTaxa(given, samples, true).classification_completed).toBe(false);
        });

        test("not linked: empty, every sample counted as not imported", () => {
            expect(buildProjectStatsEcoTaxa(EMPTY_ECOTAXA_SUMMARY, [projectStatsSample(), projectStatsSample()], false)).toEqual({
                linked: false,
                ...EMPTY_ECOTAXA_SUMMARY,
                nb_samples_not_imported: 2,
                classification_completed: false,
            });
        });
    });
});
