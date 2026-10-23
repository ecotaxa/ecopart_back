import { aaInMm2, esdMm } from "../../../../src/domain/use-cases/export/binned-computation";
import { ExploreUser } from "../../../../src/domain/use-cases/explore/explore-selection";
import { buildExploreMap, buildExploreProjectRows, buildExploreSelection, buildExploreSummary, PRESSURE_HISTOGRAM_STEP_DB, toContact } from "../../../../src/domain/use-cases/explore/explore-stats";
import { ALICE, BOB, contextsOf, exploreContext, exploreProject, exploreSample, privileges } from "./explore-fixtures";

const ANONYMOUS: ExploreUser = { user_id: null, is_admin: false };
const LOGGED: ExploreUser = { user_id: BOB.user_id, is_admin: false };

const UVP6 = exploreProject(1, "open", { project_title: "Ligurian profiles", instrument_model: "UVP6LP", ecotaxa_project_name: "Ligurian UVP6" });
const UVP5 = exploreProject(2, "private", { project_title: "Arctic moorings", instrument_model: "UVP5HD" });
const CONTEXTS = contextsOf(
    exploreContext(UVP6, { privacy: "open", nb_samples: 30, privileges: privileges(1, [ALICE, BOB]), is_my_project: true }),
    exploreContext(UVP5, { privacy: "private", nb_samples: 4, privileges: null }),
);

describe("buildExploreSummary", () => {
    test("no sample: no summary", () => {
        expect(buildExploreSummary([], CONTEXTS)).toBeNull();
    });

    test("counts projects, samples, particles (null ignored) and images", () => {
        const summary = buildExploreSummary([
            exploreSample({ sample_id: 1, project_id: 1, nb_particles: 100, nb_vignettes: 10 }),
            exploreSample({ sample_id: 2, project_id: 1, nb_particles: null, nb_vignettes: 0 }),
            exploreSample({ sample_id: 3, project_id: 2, nb_particles: 250, nb_vignettes: 32 }),
        ], CONTEXTS);

        expect(summary?.counts).toEqual({ projects: 2, samples: 3, particles: 350, images: 42 });
    });

    test("counts the sample types", () => {
        const summary = buildExploreSummary([
            exploreSample({ sample_id: 1, sample_type_label: "Depth" }),
            exploreSample({ sample_id: 2, sample_type_label: "Depth" }),
            exploreSample({ sample_id: 3, sample_type_label: "Time" }),
        ], CONTEXTS);

        expect(summary?.sample_types).toEqual({ depth: 2, time: 1, total: 3 });
    });

    test("the pressure range starts at 0 and ends at the deepest sample, null without any pressure", () => {
        expect(buildExploreSummary([exploreSample({ max_pressure: 120.5 }), exploreSample({ max_pressure: 980 }), exploreSample({ max_pressure: null })], CONTEXTS)?.pressure_range)
            .toEqual({ min: 0, max: 980 });
        expect(buildExploreSummary([exploreSample({ max_pressure: null })], CONTEXTS)?.pressure_range).toBeNull();
    });

    test("the histogram has contiguous 100 dbar bins from 0, labelled by their upper edge, empty ones included", () => {
        const summary = buildExploreSummary([50, 120, 450, 100, -5, null].map((max_pressure, i) => exploreSample({ sample_id: i + 1, max_pressure })), CONTEXTS);

        expect(PRESSURE_HISTOGRAM_STEP_DB).toBe(100);
        expect(summary?.max_pressure_histogram).toEqual([
            { max_pressure: 100, nb_profiles: 2 },
            { max_pressure: 200, nb_profiles: 2 },
            { max_pressure: 300, nb_profiles: 0 },
            { max_pressure: 400, nb_profiles: 0 },
            { max_pressure: 500, nb_profiles: 1 },
        ]);
        expect(buildExploreSummary([exploreSample({ max_pressure: null })], CONTEXTS)?.max_pressure_histogram).toEqual([]);
    });

    test("the size range is the ESD in µm of the smallest and largest particle areas, with the UVP6 Aa divided by 10⁶", () => {
        const uvp6 = exploreSample({ sample_id: 1, project_id: 1, particle_min_area_px: 1, particle_max_area_px: 4000, instrument_settings_aa: 2300, instrument_settings_exp: 1.136 });
        const uvp5 = exploreSample({ sample_id: 2, project_id: 2, particle_min_area_px: 2, particle_max_area_px: 100, instrument_settings_aa: 0.0032, instrument_settings_exp: 1.36 });

        const only_uvp6 = buildExploreSummary([uvp6], CONTEXTS)?.size_range;
        expect(only_uvp6?.min).toBeCloseTo(54.1, 1);
        expect(only_uvp6?.max).toBeCloseTo(esdMm(4000, aaInMm2("UVP6LP", 2300), 1.136) * 1000, 6);

        const only_uvp5 = buildExploreSummary([uvp5], CONTEXTS)?.size_range;
        expect(only_uvp5?.min).toBeCloseTo(esdMm(2, 0.0032, 1.36) * 1000, 6);
        expect(only_uvp5?.min).toBeCloseTo(102.3, 1);

        const both = buildExploreSummary([uvp6, uvp5], CONTEXTS)?.size_range;
        expect(both?.min).toBeCloseTo(only_uvp6?.min as number, 6);
        expect(both?.max).toBeCloseTo(only_uvp6?.max as number, 6);
    });

    test("samples without particle areas, calibration or project do not count in the size range", () => {
        const summary = buildExploreSummary([
            exploreSample({ sample_id: 1, particle_min_area_px: null }),
            exploreSample({ sample_id: 2, particle_max_area_px: null }),
            exploreSample({ sample_id: 3, instrument_settings_aa: 0 }),
            exploreSample({ sample_id: 4, instrument_settings_exp: 0 }),
            exploreSample({ sample_id: 5, project_id: 99 }),
        ], CONTEXTS);

        expect(summary?.size_range).toBeNull();
    });

    test("the time range and the profiles are ISO dates; profiles need a latitude", () => {
        const summary = buildExploreSummary([
            exploreSample({ sample_id: 1, sampling_utc_date_time: "2024-06-12T10:20:00Z", latitude: 43.4 }),
            exploreSample({ sample_id: 2, sampling_utc_date_time: "2023-01-05T23:30:00Z", latitude: null }),
            exploreSample({ sample_id: 3, sampling_utc_date_time: "2024-12-01T02:15:00Z", latitude: -10.5 }),
            exploreSample({ sample_id: 4, sampling_utc_date_time: "", latitude: 12 }),
        ], CONTEXTS);

        expect(summary?.time_range).toEqual({ start: "2023-01-05T23:30:00.000Z", end: "2024-12-01T02:15:00.000Z" });
        expect(summary?.profiles).toEqual([
            { date: "2024-06-12T10:20:00.000Z", latitude: 43.4 },
            { date: "2024-12-01T02:15:00.000Z", latitude: -10.5 },
        ]);
        expect(buildExploreSummary([exploreSample({ sampling_utc_date_time: "not a date" })], CONTEXTS)?.time_range).toBeNull();
    });

    test("instruments are counted per sample and sorted, an unknown project counts as 'unknown'", () => {
        const summary = buildExploreSummary([
            exploreSample({ sample_id: 1, project_id: 2 }),
            exploreSample({ sample_id: 2, project_id: 1 }),
            exploreSample({ sample_id: 3, project_id: 1 }),
            exploreSample({ sample_id: 4, project_id: 99 }),
        ], CONTEXTS);

        expect(summary?.instruments).toEqual([
            { label: "unknown", count: 1 },
            { label: "UVP5HD", count: 1 },
            { label: "UVP6LP", count: 2 },
        ]);
    });
});

describe("toContact", () => {
    test("the e-mail is only served to a logged-in user", () => {
        expect(toContact(ALICE, LOGGED)).toEqual({ user_name: "Alice Martin", email: ALICE.email });
        expect(toContact(ALICE, ANONYMOUS)).toEqual({ user_name: "Alice Martin", email: "" });
        expect(toContact(null, LOGGED)).toBeNull();
        expect(toContact(undefined, ANONYMOUS)).toBeNull();
    });
});

describe("buildExploreProjectRows", () => {
    const samples = [
        exploreSample({ sample_id: 1, project_id: 1 }),
        exploreSample({ sample_id: 2, project_id: 2 }),
        exploreSample({ sample_id: 3, project_id: 1 }),
        exploreSample({ sample_id: 4, project_id: 99 }),
    ];

    test("one row per project of the selection, sorted by title, with selected and total sample counts", () => {
        const rows = buildExploreProjectRows(samples, CONTEXTS, LOGGED);

        expect(rows.map(row => [row.project_title, row.nb_selected_samples, row.nb_samples])).toEqual([
            ["Arctic moorings", 1, 4],
            ["Ligurian profiles", 2, 30],
        ]);
        expect(rows[1]).toEqual({
            project_id: 1,
            project_title: "Ligurian profiles",
            instrument_model: "UVP6LP",
            ecotaxa_project_name: "Ligurian UVP6",
            nb_selected_samples: 2,
            nb_samples: 30,
            privacy_status: "open",
            is_my_project: true,
            contact: { user_name: ALICE.user_name, email: ALICE.email },
            managers: [{ user_name: ALICE.user_name, email: ALICE.email }, { user_name: BOB.user_name, email: BOB.email }],
        });
        expect(rows[0]).toMatchObject({ ecotaxa_project_name: null, contact: null, managers: [], privacy_status: "private", is_my_project: false });
    });

    test("an anonymous viewer gets empty e-mails", () => {
        const rows = buildExploreProjectRows(samples, CONTEXTS, ANONYMOUS);

        expect(rows[1].contact).toEqual({ user_name: ALICE.user_name, email: "" });
        expect(rows[1].managers).toEqual([{ user_name: ALICE.user_name, email: "" }, { user_name: BOB.user_name, email: "" }]);
    });

    test("projects with the same title are ordered by id", () => {
        const twins = contextsOf(
            exploreContext(exploreProject(7, "open", { project_title: "Same title" })),
            exploreContext(exploreProject(3, "open", { project_title: "Same title" })),
        );
        const rows = buildExploreProjectRows([exploreSample({ project_id: 7 }), exploreSample({ project_id: 3 })], twins, LOGGED);

        expect(rows.map(row => row.project_id)).toEqual([3, 7]);
    });
});

describe("buildExploreSelection", () => {
    test("bundles the summary and the project rows, both empty without sample", () => {
        expect(buildExploreSelection([], CONTEXTS, LOGGED)).toEqual({ summary: null, projects: [] });
        const selection = buildExploreSelection([exploreSample({ project_id: 1 })], CONTEXTS, LOGGED);
        expect(selection.summary?.counts.samples).toBe(1);
        expect(selection.projects.map(row => row.project_id)).toEqual([1]);
    });
});

describe("buildExploreMap", () => {
    test("one point per sample with finite coordinates and a known project", () => {
        const points = buildExploreMap([
            exploreSample({ sample_id: 1, sample_name: "moose_001", project_id: 1, latitude: 43.4, longitude: 7.87 }),
            exploreSample({ sample_id: 2, project_id: 1, latitude: null }),
            exploreSample({ sample_id: 3, project_id: 2, longitude: null }),
            exploreSample({ sample_id: 4, project_id: 2, latitude: NaN }),
            exploreSample({ sample_id: 5, project_id: 99 }),
            exploreSample({ sample_id: 6, sample_name: "arctic_006", project_id: 2, latitude: 78.9, longitude: -0.5 }),
        ], CONTEXTS);

        expect(points).toEqual([
            { sample_id: 1, sample_name: "moose_001", project_id: 1, project_title: "Ligurian profiles", latitude: 43.4, longitude: 7.87, instrument_model: "UVP6LP", privacy_status: "open", is_my_project: true },
            { sample_id: 6, sample_name: "arctic_006", project_id: 2, project_title: "Arctic moorings", latitude: 78.9, longitude: -0.5, instrument_model: "UVP5HD", privacy_status: "private", is_my_project: false },
        ]);
    });
});
