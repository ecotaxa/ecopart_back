import { PivotImageRecord, PivotParticleBlock } from "../../../../src/domain/entities/binned-export";
import { SampleParticleStats } from "../../../../src/domain/entities/sample";
import { PivotImages } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { BinnedSampleSettings, computeBinnedSample } from "../../../../src/domain/use-cases/export/binned-computation";
import { computeParticleStats, describeParticleStats } from "../../../../src/domain/use-cases/sample/particle-stats";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";

const T0 = Date.UTC(2024, 5, 12, 10, 20, 0);

// One pivot line. `blocks` are [area_px, nb_particles].
function img(raw_pressure: number | null, blocks: Array<[number, number]> = [], extra: Partial<PivotImageRecord> = {}): PivotImageRecord {
    const block_list: PivotParticleBlock[] = blocks.map(([area_px, nb_particles]) => ({ area_px, nb_particles, grey_mean: 10 }));
    return {
        image_index: 0,
        image_id: "img",
        raw_pressure,
        image_time_ms: T0,
        light_on: true,
        spectrum_counts: Object.fromEntries(block_list.map((b) => [b.area_px, b.nb_particles])),
        blocks: block_list,
        ...extra,
    };
}

// Numbers the lines and spaces their times one minute apart.
function sequence(records: PivotImageRecord[]): PivotImageRecord[] {
    return records.map((r, i) => ({ ...r, image_index: i, image_id: `img${i}`, image_time_ms: T0 + i * 60_000 }));
}

// A pivot read in two passes: the columns from `records`, the rows from `rows` (the same by default).
function pivotOf(records: PivotImageRecord[], rows: PivotImageRecord[] = records): PivotImages {
    return { columns: toPerImageColumns(records), rows: async function* () { yield* rows; } };
}

const UVP6: BinnedSampleSettings = {
    sample_name: "uvp6_sample",
    instrument_model: "UVP6LP",
    is_depth_profile: true,
    descent_filter_enabled: false,
    filter_first_image: null,
    filter_last_image: null,
    depth_offset_m: 0,
    image_volume_l: 0.5,
    aa: 2300,
    exp: 1.136,
    particle_minimum_area_px: null,
};
const UVP5: BinnedSampleSettings = { ...UVP6, sample_name: "uvp5_sample", instrument_model: "UVP5HD", aa: 0.0026, exp: 1.2284 };

// The statistics over the images of the window, then over those the descent filter keeps too (the same by default).
type Tally = [number, number | null, number | null];
function stats(window: Tally, descent: Tally = window): SampleParticleStats {
    return {
        nb_particles: window[0], particle_min_area_px: window[1], particle_max_area_px: window[2],
        nb_particles_descent_filter: descent[0], particle_min_area_px_descent_filter: descent[1], particle_max_area_px_descent_filter: descent[2],
    };
}

describe("computeParticleStats", () => {
    test("sums the particles of every block and gives the smallest and largest areas", async () => {
        const records = sequence([img(1, [[1, 7], [12, 2]]), img(2, [[3, 4], [250, 1]]), img(3)]);

        await expect(computeParticleStats(UVP6, pivotOf(records))).resolves.toEqual(stats([14, 1, 250]));
    });

    test("a sample without particle has no area", async () => {
        await expect(computeParticleStats(UVP6, pivotOf(sequence([img(1), img(2)])))).resolves.toEqual(stats([0, null, null]));
        await expect(computeParticleStats(UVP6, pivotOf([]))).resolves.toEqual(stats([0, null, null]));
    });

    test("leaves out the images with the light off and the over-exposed ones, keeps an empty image", async () => {
        const records = sequence([
            img(1, [[2, 3]]),
            img(2, [[1, 50], [900, 1]], { light_on: false }),
            img(3, [[5, 8], [700, 1]], { particle_data_flag: "OVER_EXPOSED" }),
            img(4, [], { particle_data_flag: "EMPTY_IMAGE" }),
            img(5, [[4, 1]]),
        ]);

        await expect(computeParticleStats(UVP6, pivotOf(records))).resolves.toEqual(stats([4, 2, 4]));
    });

    test("leaves out the blocks under the minimum area, rounded up, and the blocks without particle", async () => {
        const records = sequence([img(1, [[1, 7], [2, 3], [3, 2], [40, 0], [9, 1]])]);

        await expect(computeParticleStats({ ...UVP6, particle_minimum_area_px: 2.5 }, pivotOf(records))).resolves.toEqual(stats([3, 3, 9]));
        await expect(computeParticleStats({ ...UVP6, particle_minimum_area_px: 2 }, pivotOf(records))).resolves.toEqual(stats([6, 2, 9]));
        // No minimum (or one under a pixel): every block counts.
        await expect(computeParticleStats({ ...UVP6, particle_minimum_area_px: 0 }, pivotOf(records))).resolves.toEqual(stats([13, 1, 9]));
    });

    describe("counts the images the sample uses, without and with the descent filter", () => {
        // The third image goes back up: the descent filter drops it.
        const yoyo = sequence([img(1, [[1, 1]]), img(10, [[2, 1]]), img(6, [[30, 5]]), img(12, [[4, 1]])]);

        test("both pairs are computed on a depth profile, whatever the project's setting", async () => {
            const expected = stats([8, 1, 30], [3, 1, 4]);
            await expect(computeParticleStats({ ...UVP6, descent_filter_enabled: true }, pivotOf(yoyo))).resolves.toEqual(expected);
            await expect(computeParticleStats({ ...UVP6, descent_filter_enabled: false }, pivotOf(yoyo))).resolves.toEqual(expected);
        });

        test("the depth offset does not change them: it moves every image by the same depth", async () => {
            await expect(computeParticleStats({ ...UVP6, depth_offset_m: 50 }, pivotOf(yoyo))).resolves.toEqual(stats([8, 1, 30], [3, 1, 4]));
        });

        test("the descent filter never applies to a time series: both pairs are equal", async () => {
            await expect(computeParticleStats({ ...UVP6, descent_filter_enabled: true, is_depth_profile: false }, pivotOf(yoyo))).resolves.toEqual(stats([8, 1, 30]));
        });

        test("a UVP6 file is cut to the operator window by rank, a UVP5 pivot was cut at conversion", async () => {
            const window = { filter_first_image: "100", filter_last_image: "101" };
            await expect(computeParticleStats({ ...UVP6, ...window }, pivotOf(yoyo))).resolves.toEqual(stats([2, 1, 2]));
            await expect(computeParticleStats({ ...UVP5, ...window }, pivotOf(yoyo))).resolves.toEqual(stats([8, 1, 30], [3, 1, 4]));
        });

        test("a depth profile leaves out the images without pressure, a time series keeps them", async () => {
            const records = sequence([img(null, [[50, 2]]), img(2, [[3, 1]])]);
            await expect(computeParticleStats(UVP6, pivotOf(records))).resolves.toEqual(stats([1, 3, 3]));
            await expect(computeParticleStats({ ...UVP6, is_depth_profile: false }, pivotOf(records))).resolves.toEqual(stats([3, 3, 50]));
        });

        test("each pair is the number of particles the binned export counts over all its bins, without and with the descent filter", async () => {
            const records = sequence([
                img(1, [[1, 7], [2, 3], [3, 2]]),
                img(10, [[1, 1], [5, 4]]),
                img(6, [[2, 9]]),
                img(14, [[3, 2]], { light_on: false }),
                img(15, [[8, 1]], { particle_data_flag: "OVER_EXPOSED" }),
                img(20, [[1, 2], [40, 1]]),
            ]);
            const settings = { ...UVP6, particle_minimum_area_px: 1 };
            const binnedCount = (descent_filter_enabled: boolean) => computeBinnedSample({ ...settings, descent_filter_enabled }, records, { axis: "depth", step: 5 })
                .bins.reduce((sum, bin) => sum + bin.counts.reduce((a, b) => a + b, 0), 0);

            const computed = await computeParticleStats(settings, pivotOf(records));
            expect(computed.nb_particles).toBe(binnedCount(false));
            expect(computed.nb_particles_descent_filter).toBe(binnedCount(true));
            expect(computed).toEqual(stats([29, 1, 40], [20, 1, 40]));
        });
    });

    describe("refuses a file that changed between the two passes", () => {
        const changedWhileRead = "The particle file of sample uvp6_sample changed while it was read. Compute its particle statistics again.";
        const records = sequence([img(1, [[1, 7]]), img(2, [[2, 3]]), img(3, [[3, 1]])]);

        test("another row", async () => {
            await expect(computeParticleStats(UVP6, pivotOf(records, [records[0], records[2], records[1]]))).rejects.toThrow(changedWhileRead);
        });

        test("fewer rows", async () => {
            await expect(computeParticleStats(UVP6, pivotOf(records, records.slice(0, 2)))).rejects.toThrow(changedWhileRead);
        });

        test("more rows", async () => {
            await expect(computeParticleStats(UVP6, pivotOf(records, [...records, { ...records[0], image_id: "img3" }]))).rejects.toThrow(changedWhileRead);
        });
    });
});

describe("describeParticleStats", () => {
    test("gives the count and the area range, the count kept by the descent filter when it differs, or says there is no particle", () => {
        expect(describeParticleStats("perle3_001", stats([14, 1, 250]))).toBe("perle3_001: 14 particle(s) counted, areas from 1 to 250 px");
        expect(describeParticleStats("perle3_001", stats([14, 1, 250], [9, 1, 30]))).toBe("perle3_001: 14 particle(s) counted, areas from 1 to 250 px, 9 kept by the descent filter");
        expect(describeParticleStats("perle3_001", stats([0, null, null]))).toBe("perle3_001: no particle counted");
    });
});
