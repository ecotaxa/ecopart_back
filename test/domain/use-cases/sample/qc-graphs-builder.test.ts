import { PerImageRecord } from "../../../../src/domain/entities/sample-qc-graph";
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
        records: [],
        ...overrides,
    };
}

describe("buildSampleQcGraphs — image_filtering (descent filter)", () => {
    test("UVP5: keeps the descent, drops ascent blips; last_image_used = deepest kept", () => {
        // depths (gain 0.1): 10, 20, 15(blip up), 30, 25(ascent) → keep 10,20,30; drop 15,25.
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "1", raw_pressure: 100, light_on: true, spectrum_counts: {} },
            { image_index: 1, image_id: "2", raw_pressure: 200, light_on: true, spectrum_counts: {} },
            { image_index: 2, image_id: "3", raw_pressure: 150, light_on: true, spectrum_counts: {} },
            { image_index: 3, image_id: "4", raw_pressure: 300, light_on: true, spectrum_counts: {} },
            { image_index: 4, image_id: "5", raw_pressure: 250, light_on: true, spectrum_counts: {} },
        ];
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
    });

    test("UVP6: descent filter is depth-based, works the same on timestamp ids", () => {
        // depths (gain 1): 0.5, 1.5, 1.0(blip), 2.0 → keep 0.5,1.5,2.0; drop 1.0.
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "20240612-003906-1", raw_pressure: 0.5, light_on: true, spectrum_counts: {} },
            { image_index: 1, image_id: "20240612-003907-1", raw_pressure: 1.5, light_on: true, spectrum_counts: {} },
            { image_index: 2, image_id: "20240612-003908-1", raw_pressure: 1.0, light_on: true, spectrum_counts: {} },
            { image_index: 3, image_id: "20240612-003909-1", raw_pressure: 2.0, light_on: true, spectrum_counts: {} },
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
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "1", raw_pressure: 100, light_on: true, spectrum_counts: {} },
            { image_index: 1, image_id: "2", raw_pressure: 200, light_on: true, spectrum_counts: {} },
            { image_index: 2, image_id: "3", raw_pressure: 150, light_on: true, spectrum_counts: {} },
            { image_index: 3, image_id: "4", raw_pressure: 300, light_on: true, spectrum_counts: {} },
        ];
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
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "1", raw_pressure: 100, light_on: true, spectrum_counts: {} },
            { image_index: 1, image_id: "2", raw_pressure: 200, light_on: true, spectrum_counts: {} },
            { image_index: 2, image_id: "3", raw_pressure: 150, light_on: true, spectrum_counts: {} },
            { image_index: 3, image_id: "4", raw_pressure: 300, light_on: true, spectrum_counts: {} },
            { image_index: 4, image_id: "5", raw_pressure: 250, light_on: true, spectrum_counts: {} },
        ];
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
