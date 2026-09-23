import { BinnedDepthProfile, BinnedProfile, BinnedTimeProfile, PerImageRecord } from "../../../../src/domain/entities/sample-qc-graph";
import { buildSampleQcGraphs, QcGraphInput } from "../../../../src/domain/use-cases/sample/qc-graphs-builder";

function input(overrides: Partial<QcGraphInput>): QcGraphInput {
    return {
        sample_id: null,
        sample_name: "s",
        instrument_model: "UVP5HD",
        visual_qc_status_label: "NOT_IMPORTED",
        filter_first_image: null,
        filter_last_image: null,
        instrument_settings_depth_offset_m: 0,
        instrument_settings_image_volume_l: 1,
        is_depth_profile: true,
        descent_filter_enabled: true,
        records: [],
        ...overrides,
    };
}

// One lit image with no particles and no readable time, unless the test says otherwise.
function rec(image_index: number, image_id: string, raw_pressure: number, overrides: Partial<PerImageRecord> = {}): PerImageRecord {
    return { image_index, image_id, raw_pressure, image_time_ms: null, light_on: true, spectrum_counts: {}, ...overrides };
}

function depthProfile(profile: BinnedProfile | null): BinnedDepthProfile {
    if (profile === null || profile.axis !== "depth") throw new Error("expected a depth-binned profile");
    return profile;
}

function timeProfile(profile: BinnedProfile | null): BinnedTimeProfile {
    if (profile === null || profile.axis !== "time") throw new Error("expected a time-binned profile");
    return profile;
}

const selection = (res: ReturnType<typeof buildSampleQcGraphs>) => res.image_depth_profile.points.map((p) => p.is_selected);

describe("buildSampleQcGraphs — image_filtering (descent filter)", () => {
    test("UVP5: keeps the descent, drops ascent blips; last_image_used = deepest kept", () => {
        // depths (gain 0.1): 10, 20, 15(blip up), 30, 25(ascent) → keep 10,20,30; drop 15,25.
        const records = [rec(0, "1", 100), rec(1, "2", 200), rec(2, "3", 150), rec(3, "4", 300), rec(4, "5", 250)];
        const res = buildSampleQcGraphs(input({
            sample_id: 5,
            instrument_model: "UVP5HD",
            filter_first_image: "1",
            filter_last_image: "5",
            records,
        }));

        expect(res.sample_id).toBe(5);
        const f = res.image_filtering;
        expect(f.first_image).toBe("1");
        expect(f.last_image).toBe("5");
        // Deepest kept image is frame 4 (depth 30); frames 3 and 5 are removed by the descent filter.
        expect(f.last_image_used).toBe("4");
        expect(f.removed_images.count).toBe(2);
        expect(f.removed_images.percent).toBeCloseTo((2 / 5) * 100);
        // …and graph 1 shows them as not selected.
        expect(selection(res)).toEqual([true, true, false, true, false]);
    });

    test("UVP6: descent filter is depth-based, works the same on timestamp ids", () => {
        // depths (gain 1): 0.5, 1.5, 1.0(blip), 2.0 → keep 0.5,1.5,2.0; drop 1.0.
        const records = [
            rec(0, "20240612-003906-1", 0.5),
            rec(1, "20240612-003907-1", 1.5),
            rec(2, "20240612-003908-1", 1.0),
            rec(3, "20240612-003909-1", 2.0),
        ];
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP6LP",
            filter_first_image: "20240612-003906-1",
            filter_last_image: "20240612-003909-1",
            records,
        }));

        const f = res.image_filtering;
        expect(f.first_image).toBe("20240612-003906-1");
        expect(f.last_image).toBe("20240612-003909-1");
        expect(f.last_image_used).toBe("20240612-003909-1");
        expect(f.removed_images.count).toBe(1);
        expect(f.removed_images.percent).toBeCloseTo((1 / 4) * 100);
    });

    test("sentinel endimg (99999999999) does not explode; window opens to the end", () => {
        // depths: 10, 20, 15(blip), 30. first_image=2 → window is frames 2,3,4; endimg is a sentinel.
        const records = [rec(0, "1", 100), rec(1, "2", 200), rec(2, "3", 150), rec(3, "4", 300)];
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP5HD",
            filter_first_image: "2",
            filter_last_image: "99999999999",
            records,
        }));

        const f = res.image_filtering;
        expect(f.first_image).toBe("2");
        expect(f.last_image).toBe("99999999999"); // reported verbatim…
        // …window = frames 2,3,4 (depths 20,15,30); frame 3 is dropped; deepest kept is frame 4.
        expect(f.last_image_used).toBe("4");
        expect(f.removed_images.count).toBe(1);
        expect(f.removed_images.percent).toBeCloseTo((1 / 3) * 100);
    });

    test("time profile: descent filter is NOT applied — nothing removed, last used = last in window", () => {
        // Same non-monotonic depths as the UVP5 descent case, but a time series → no descent filter.
        const records = [rec(0, "1", 100), rec(1, "2", 200), rec(2, "3", 150), rec(3, "4", 300), rec(4, "5", 250)];
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP5HD",
            is_depth_profile: false,
            filter_first_image: "1",
            filter_last_image: "5",
            records,
        }));

        const f = res.image_filtering;
        expect(f.removed_images).toEqual({ count: 0, percent: 0 });
        expect(f.last_image_used).toBe("5"); // last image in the window, not the deepest
        expect(selection(res)).toEqual([true, true, true, true, true]);
    });

    test("no records → neutral filtering block", () => {
        const res = buildSampleQcGraphs(input({ filter_first_image: "1", filter_last_image: "9", records: [] }));
        expect(res.image_filtering).toEqual({
            first_image: "1",
            last_image: "9",
            last_image_used: null,
            removed_images: { count: 0, percent: 0 },
        });
    });
});

describe("buildSampleQcGraphs — operator window [firstimage, endimg]", () => {
    test("UVP6: the header bounds are ranks — row k is rank firstimage + k, so a file cut by UVPapp is all selected", () => {
        const records = [rec(0, "20240612-003906-1", 0.5), rec(1, "20240612-003907-1", 1.0), rec(2, "20240612-003908-1", 1.5)];
        const res = buildSampleQcGraphs(input({ instrument_model: "UVP6LP", filter_first_image: "2470", filter_last_image: "2472", records }));

        expect(selection(res)).toEqual([true, true, true]);
        expect(res.image_depth_profile.selected_images).toBe(3);
        expect(res.image_filtering).toEqual({
            first_image: "2470",
            last_image: "2472",
            last_image_used: "20240612-003908-1",
            removed_images: { count: 0, percent: 0 },
        });
    });

    test("UVP6: rows past endimg are not selected when the file holds more than the window", () => {
        const records = [rec(0, "20240612-003906-1", 0.5), rec(1, "20240612-003907-1", 1.0), rec(2, "20240612-003908-1", 1.5), rec(3, "20240612-003909-1", 2.0)];
        const res = buildSampleQcGraphs(input({ instrument_model: "UVP6LP", filter_first_image: "2470", filter_last_image: "2472", records }));

        // Rank of row 3 is 2473 > endimg.
        expect(selection(res)).toEqual([true, true, true, false]);
        expect(res.image_filtering.last_image_used).toBe("20240612-003908-1");
    });

    test("UVP6: bounds handed over as numbers (metadata.ini) behave like their string form", () => {
        const records = [rec(0, "20240303-000001-1", 150), rec(1, "20240303-000002-1", 150), rec(2, "20240303-000003-1", 150)];
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP6LP",
            filter_first_image: 0 as any,
            filter_last_image: 1 as any,
            records,
        }));

        expect(selection(res)).toEqual([true, true, false]);
        expect(res.image_filtering.first_image).toBe("0");
        expect(res.image_filtering.last_image).toBe("1");
        expect(res.image_depth_profile.filter_first_image).toBe("0");
    });

    test("UVP5: the bounds are frame indices compared numerically — a gap, a bound before the first frame and the E10 sentinel all work", () => {
        // Frame numbering starts at 71 and skips 73-74, as in real datfiles.
        const records = [rec(0, "71", 100), rec(1, "72", 110), rec(2, "75", 120), rec(3, "76", 130)];

        const in_gap = buildSampleQcGraphs(input({ filter_first_image: "73", filter_last_image: "9.9999999999E10", records }));
        expect(selection(in_gap)).toEqual([false, false, true, true]);

        const before_first_frame = buildSampleQcGraphs(input({ filter_first_image: "58", filter_last_image: "75", records }));
        expect(selection(before_first_frame)).toEqual([true, true, true, false]);
        expect(before_first_frame.image_filtering.last_image_used).toBe("75");
    });

    test("a non-numeric bound matching no image id leaves its end open (UVP6 timestamp bounds)", () => {
        const records = [rec(0, "20220608-184239-906", 16.65), rec(1, "20220608-184240-407", 16.73), rec(2, "20220608-184241-907", 16.82)];
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP6LP",
            filter_first_image: "20220608-184239-000",
            filter_last_image: "20220608-184241-000",
            records,
        }));

        expect(selection(res)).toEqual([true, true, true]);
    });
});

describe("buildSampleQcGraphs — graphs 2 and 3 only count the selected images", () => {
    // UVP5 depths (gain 0.1): 5 (before first), 10, 20, 15 (ascent blip), 30, 40 (after last).
    const records = [
        rec(0, "1", 50, { spectrum_counts: { 1: 1 } }),
        rec(1, "2", 100, { spectrum_counts: { 1: 2 } }),
        rec(2, "3", 200, { spectrum_counts: { 1: 4 } }),
        rec(3, "4", 150, { spectrum_counts: { 1: 8 } }),
        rec(4, "5", 300, { spectrum_counts: { 1: 16 } }),
        rec(5, "6", 400, { spectrum_counts: { 1: 32 } }),
    ];

    test("images outside the window or dropped by the descent filter are not selected nor binned", () => {
        const res = buildSampleQcGraphs(input({ filter_first_image: "2", filter_last_image: "5", records }));

        expect(selection(res)).toEqual([false, true, true, false, true, false]);
        expect(res.image_depth_profile.total_images).toBe(6);
        expect(res.image_depth_profile.selected_images).toBe(3);
        expect(depthProfile(res.imaged_volume_profile).series[0].points).toEqual([
            { depth_m: 10.5, value: 1 },
            { depth_m: 20.5, value: 1 },
            { depth_m: 30.5, value: 1 },
        ]);
        expect(depthProfile(res.particle_lpm_profile).series[0].points).toEqual([
            { depth_m: 10.5, value: 2 },
            { depth_m: 20.5, value: 4 },
            { depth_m: 30.5, value: 16 },
        ]);
        expect(res.image_filtering.removed_images).toEqual({ count: 1, percent: 25 });
    });

    test("a project with the descent filter disabled selects every image of the window", () => {
        const res = buildSampleQcGraphs(input({ filter_first_image: "2", filter_last_image: "5", descent_filter_enabled: false, records }));

        expect(selection(res)).toEqual([false, true, true, true, true, false]);
        expect(depthProfile(res.imaged_volume_profile).series[0].points.map((p) => p.depth_m)).toEqual([10.5, 15.5, 20.5, 30.5]);
        expect(res.image_filtering.removed_images).toEqual({ count: 0, percent: 0 });
    });

    test("a time profile selects every image of the window, whatever the depths", () => {
        const res = buildSampleQcGraphs(input({ filter_first_image: "2", filter_last_image: "5", is_depth_profile: false, records }));

        expect(selection(res)).toEqual([false, true, true, true, true, false]);
    });

    test("the imaged volume counts the selected lit images only; the dark frames go to black_profile", () => {
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP6LP",
            instrument_settings_image_volume_l: 2,
            records: [
                rec(0, "a", 0.5, { spectrum_counts: { 1: 10 } }),
                rec(1, "b", 0.7, { light_on: false, spectrum_counts: { 1: 3 } }),
                rec(2, "c", 1.5, { spectrum_counts: { 1: 20 } }),
            ],
        }));

        expect(depthProfile(res.imaged_volume_profile).series[0].points).toEqual([
            { depth_m: 0.5, value: 2 },   // 1 lit image — the dark frame of this bin is not counted
            { depth_m: 1.5, value: 2 },
        ]);
        expect(depthProfile(res.particle_lpm_profile).series[0].points).toEqual([{ depth_m: 0.5, value: 10 }, { depth_m: 1.5, value: 20 }]);
        expect(depthProfile(res.black_profile).series[0].points).toEqual([{ depth_m: 0.5, value: 3 }]);
    });

    test("black_profile stays present, and empty, when no dark frame is selected", () => {
        // The dark frame (1.0 m, after 1.5 m) is dropped by the descent filter.
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP6LP",
            records: [rec(0, "a", 0.5), rec(1, "b", 1.5), rec(2, "c", 1.0, { light_on: false, spectrum_counts: { 1: 3 } })],
        }));

        expect(res.black_profile).not.toBeNull();
        expect(depthProfile(res.black_profile).series[0].points).toEqual([]);
    });
});

describe("buildSampleQcGraphs — vertical axis", () => {
    const at = (h: number, m: number, s: number): number => Date.UTC(2024, 2, 3, h, m, s);
    // A UVP6 time series at constant depth: two bursts 4 h apart, one dark frame.
    const series = [
        rec(0, "20240303-000001-1", 150, { image_time_ms: at(0, 0, 1), spectrum_counts: { 1: 1 } }),
        rec(1, "20240303-000030-1", 150, { image_time_ms: at(0, 0, 30), light_on: false, spectrum_counts: { 1: 5 } }),
        rec(2, "20240303-040030-1", 150, { image_time_ms: at(4, 0, 30), spectrum_counts: { 1: 2 } }),
        rec(3, "20240303-040100-1", 150, { image_time_ms: at(4, 1, 0), spectrum_counts: { 1: 3 } }),
    ];

    test("time sample: hours since the UTC hour of the first image, binned by 1 h", () => {
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP6LP",
            is_depth_profile: false,
            filter_first_image: "0",
            filter_last_image: "3",
            records: series,
        }));

        expect(res.vertical_axis).toBe("time");
        expect(res.time_origin_utc_date_time).toBe("2024-03-03T00:00:00.000Z");
        expect(res.image_depth_profile.points[0].time_h).toBeCloseTo(1 / 3600);
        expect(res.image_depth_profile.points[2].time_h).toBeCloseTo(4 + 30 / 3600);
        expect(res.image_depth_profile.points[0].depth_m).toBe(150); // depth stays available on graph 1
        expect(res.image_depth_profile.selected_images).toBe(4);

        const volume = timeProfile(res.imaged_volume_profile);
        expect(volume.bin_size_h).toBe(1);
        expect(volume.series[0].points).toEqual([{ time_h: 0.5, value: 1 }, { time_h: 4.5, value: 2 }]);
        expect(timeProfile(res.particle_lpm_profile).series[0].points).toEqual([{ time_h: 0.5, value: 1 }, { time_h: 4.5, value: 5 }]);
        expect(timeProfile(res.black_profile).series[0].points).toEqual([{ time_h: 0.5, value: 5 }]);
        expect(res.image_filtering.last_image_used).toBe("20240303-040100-1");
    });

    test("images without a readable time are left out of the time bins", () => {
        const res = buildSampleQcGraphs(input({
            instrument_model: "UVP6LP",
            is_depth_profile: false,
            records: [series[0], rec(1, "not-a-time", 150)],
        }));

        expect(res.image_depth_profile.points[1].time_h).toBeNull();
        expect(timeProfile(res.imaged_volume_profile).series[0].points).toEqual([{ time_h: 0.5, value: 1 }]);
    });

    test("a depth sample keeps the depth axis even when its image times are readable", () => {
        const res = buildSampleQcGraphs(input({ instrument_model: "UVP6LP", records: series }));

        expect(res.vertical_axis).toBe("depth");
        expect(res.imaged_volume_profile.axis).toBe("depth");
        expect(res.image_depth_profile.points[0].time_h).toBeCloseTo(1 / 3600);
    });

    test("a time sample with no readable image time falls back to the depth axis", () => {
        const res = buildSampleQcGraphs(input({ is_depth_profile: false, records: [rec(0, "1", 100), rec(1, "2", 200)] }));

        expect(res.vertical_axis).toBe("depth");
        expect(res.time_origin_utc_date_time).toBeNull();
        expect(res.image_depth_profile.points[0].time_h).toBeNull();
        expect(depthProfile(res.imaged_volume_profile).bin_size_m).toBe(1);
    });
});
