import { PivotImageRecord, PivotParticleBlock } from "../../../../src/domain/entities/binned-export";
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

describe("computeParticleStats", () => {
    test("sums the particles of every block and gives the smallest and largest areas", async () => {
        const records = sequence([img(1, [[1, 7], [12, 2]]), img(2, [[3, 4], [250, 1]]), img(3)]);

        await expect(computeParticleStats(UVP6, pivotOf(records))).resolves.toEqual({ nb_particles: 14, particle_min_area_px: 1, particle_max_area_px: 250 });
    });

    test("a sample without particle has no area", async () => {
        await expect(computeParticleStats(UVP6, pivotOf(sequence([img(1), img(2)])))).resolves.toEqual({ nb_particles: 0, particle_min_area_px: null, particle_max_area_px: null });
        await expect(computeParticleStats(UVP6, pivotOf([]))).resolves.toEqual({ nb_particles: 0, particle_min_area_px: null, particle_max_area_px: null });
    });

    test("leaves out the images with the light off and the over-exposed ones, keeps an empty image", async () => {
        const records = sequence([
            img(1, [[2, 3]]),
            img(2, [[1, 50], [900, 1]], { light_on: false }),
            img(3, [[5, 8], [700, 1]], { particle_data_flag: "OVER_EXPOSED" }),
            img(4, [], { particle_data_flag: "EMPTY_IMAGE" }),
            img(5, [[4, 1]]),
        ]);

        await expect(computeParticleStats(UVP6, pivotOf(records))).resolves.toEqual({ nb_particles: 4, particle_min_area_px: 2, particle_max_area_px: 4 });
    });

    test("leaves out the blocks under the minimum area, rounded up, and the blocks without particle", async () => {
        const records = sequence([img(1, [[1, 7], [2, 3], [3, 2], [40, 0], [9, 1]])]);

        await expect(computeParticleStats({ ...UVP6, particle_minimum_area_px: 2.5 }, pivotOf(records))).resolves.toEqual({ nb_particles: 3, particle_min_area_px: 3, particle_max_area_px: 9 });
        await expect(computeParticleStats({ ...UVP6, particle_minimum_area_px: 2 }, pivotOf(records))).resolves.toEqual({ nb_particles: 6, particle_min_area_px: 2, particle_max_area_px: 9 });
        // No minimum (or one under a pixel): every block counts.
        await expect(computeParticleStats({ ...UVP6, particle_minimum_area_px: 0 }, pivotOf(records))).resolves.toEqual({ nb_particles: 13, particle_min_area_px: 1, particle_max_area_px: 9 });
    });

    describe("counts the images the sample uses, like the binned export", () => {
        // The third image goes back up: the descent filter drops it.
        const yoyo = sequence([img(1, [[1, 1]]), img(10, [[2, 1]]), img(6, [[30, 5]]), img(12, [[4, 1]])]);

        test("the descent filter applies to a depth profile when the project enables it", async () => {
            await expect(computeParticleStats({ ...UVP6, descent_filter_enabled: true }, pivotOf(yoyo))).resolves.toEqual({ nb_particles: 3, particle_min_area_px: 1, particle_max_area_px: 4 });
            await expect(computeParticleStats(UVP6, pivotOf(yoyo))).resolves.toEqual({ nb_particles: 8, particle_min_area_px: 1, particle_max_area_px: 30 });
        });

        test("the descent filter never applies to a time series", async () => {
            await expect(computeParticleStats({ ...UVP6, descent_filter_enabled: true, is_depth_profile: false }, pivotOf(yoyo))).resolves.toEqual({ nb_particles: 8, particle_min_area_px: 1, particle_max_area_px: 30 });
        });

        test("a UVP6 file is cut to the operator window by rank, a UVP5 pivot was cut at conversion", async () => {
            const window = { filter_first_image: "100", filter_last_image: "101" };
            await expect(computeParticleStats({ ...UVP6, ...window }, pivotOf(yoyo))).resolves.toEqual({ nb_particles: 2, particle_min_area_px: 1, particle_max_area_px: 2 });
            await expect(computeParticleStats({ ...UVP5, ...window }, pivotOf(yoyo))).resolves.toEqual({ nb_particles: 8, particle_min_area_px: 1, particle_max_area_px: 30 });
        });

        test("a depth profile leaves out the images without pressure, a time series keeps them", async () => {
            const records = sequence([img(null, [[50, 2]]), img(2, [[3, 1]])]);
            await expect(computeParticleStats(UVP6, pivotOf(records))).resolves.toEqual({ nb_particles: 1, particle_min_area_px: 3, particle_max_area_px: 3 });
            await expect(computeParticleStats({ ...UVP6, is_depth_profile: false }, pivotOf(records))).resolves.toEqual({ nb_particles: 3, particle_min_area_px: 3, particle_max_area_px: 50 });
        });

        test("the count is the number of particles the binned export counts over all its bins", async () => {
            const records = sequence([
                img(1, [[1, 7], [2, 3], [3, 2]]),
                img(10, [[1, 1], [5, 4]]),
                img(6, [[2, 9]]),
                img(14, [[3, 2]], { light_on: false }),
                img(15, [[8, 1]], { particle_data_flag: "OVER_EXPOSED" }),
                img(20, [[1, 2], [40, 1]]),
            ]);
            const settings = { ...UVP6, descent_filter_enabled: true, particle_minimum_area_px: 1 };
            const binned = computeBinnedSample(settings, records, { axis: "depth", step: 5 });
            const binned_count = binned.bins.reduce((sum, bin) => sum + bin.counts.reduce((a, b) => a + b, 0), 0);

            const stats = await computeParticleStats(settings, pivotOf(records));
            expect(stats.nb_particles).toBe(binned_count);
            expect(stats).toEqual({ nb_particles: 20, particle_min_area_px: 1, particle_max_area_px: 40 });
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
    test("gives the count and the area range, or says there is no particle", () => {
        expect(describeParticleStats("perle3_001", { nb_particles: 14, particle_min_area_px: 1, particle_max_area_px: 250 })).toBe("perle3_001: 14 particle(s) counted, areas from 1 to 250 px");
        expect(describeParticleStats("perle3_001", { nb_particles: 0, particle_min_area_px: null, particle_max_area_px: null })).toBe("perle3_001: no particle counted");
    });
});
