import { PivotImageRecord, PivotParticleBlock } from "../../../../src/domain/entities/binned-export";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";
import {
    aaInMm2,
    BinnedSampleBuilder,
    BinnedSampleSettings,
    computeBinnedSample,
    esdMm,
    exportedSizeClasses,
    formatNumber,
    minimumAreaPx,
    particleColumns,
    particleRows,
    PARTICLE_CONTEXT_COLUMNS,
    PIXEL_COLUMNS,
    visibleSizeClasses,
} from "../../../../src/domain/use-cases/export/binned-computation";

const T0 = Date.UTC(2024, 5, 12, 10, 20, 0);

// One pivot line. `blocks` are [area_px, nb_particles, grey_mean].
function img(raw_pressure: number | null, blocks: Array<[number, number, number | null]> = [], extra: Partial<PivotImageRecord> = {}): PivotImageRecord {
    const block_list: PivotParticleBlock[] = blocks.map(([area_px, nb_particles, grey_mean]) => ({ area_px, nb_particles, grey_mean }));
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

// Numbers the lines and spaces their times one minute apart, unless a line sets its own time.
function sequence(records: PivotImageRecord[]): PivotImageRecord[] {
    return records.map((r, i) => ({ ...r, image_index: i, image_id: `img${i}`, image_time_ms: r.image_time_ms === T0 ? T0 + i * 60_000 : r.image_time_ms }));
}

// A UVP6 with Aa 2300 and Exp 1.136: 1 px falls in class 17 (50.8-64 µm), 2 px in 18, 3 px in 19.
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

const firstVisible = (visible: boolean[]) => visible.indexOf(true);
const invisibleAfterFirst = (visible: boolean[]) => visible.flatMap((v, i) => (!v && i > firstVisible(visible) ? [i] : []));

describe("calibration", () => {
    test("the UVP6 Aa is stored multiplied by 10⁶, the UVP5 aa is already in mm² per pixel", () => {
        expect(aaInMm2("UVP6HF", 2300)).toBeCloseTo(0.0023, 10);
        expect(aaInMm2("UVP5HD", 0.0026)).toBe(0.0026);
    });

    test("ESD follows legacy EcoPart: 2 × sqrt(area ^ exp × aa / π)", () => {
        expect(esdMm(1, 0.0023, 1.136)).toBeCloseTo(0.0541, 4);
        expect(esdMm(2, 0.0023, 1.136)).toBeCloseTo(0.0802, 4);
    });

    test("the minimum area is at least one pixel", () => {
        expect(minimumAreaPx(null)).toBe(1);
        expect(minimumAreaPx(undefined)).toBe(1);
        expect(minimumAreaPx(0)).toBe(1);
        expect(minimumAreaPx(2)).toBe(2);
    });
});

describe("visible size classes (M2, M3, M2b), on the calibrations of the local samples", () => {
    test("UVP6 (Aa 2300, Exp 1.136): every class from 50.8 µm up is visible", () => {
        const visible = visibleSizeClasses(0.0023, 1.136, 1);
        expect(firstVisible(visible)).toBe(17);
        expect(invisibleAfterFirst(visible)).toEqual([]);
        expect(visible[44]).toBe(true);
    });

    test("UVP5 sn201: no whole number of pixels falls in 64-80.6 µm, which is NA (M3)", () => {
        const visible = visibleSizeClasses(0.00266, 1.2194, 1);
        expect(firstVisible(visible)).toBe(17);
        expect(invisibleAfterFirst(visible)).toEqual([18]);
    });

    test("UVP5Z sn002zd: 1 px lands in 40.3-50.8 µm and 50.8-64 µm is unreachable", () => {
        const visible = visibleSizeClasses(0.0014, 1.397, 1);
        expect(firstVisible(visible)).toBe(16);
        expect(invisibleAfterFirst(visible)).toEqual([17]);
    });

    test("UVP5HD sn222 recording nothing below 2 px (s1c1): the class of 1 px is NA too (M2b)", () => {
        const visible = visibleSizeClasses(0.0026, 1.2284, 2);
        expect(firstVisible(visible)).toBe(19);
        expect(invisibleAfterFirst(visible)).toEqual([]);
        expect(visibleSizeClasses(0.0026, 1.2284, 1)[17]).toBe(true);
    });
});

describe("computeBinnedSample, depth bins", () => {
    const records = sequence([
        img(1, [[1, 10, 20], [2, 4, 30]]),                       // bin 0
        img(3, [[1, 5, 10]], { light_on: false }),               // bin 0, black image
        img(4, [], { particle_data_flag: "OVER_EXPOSED" }),      // bin 0, no volume
        img(12, [], { particle_data_flag: "EMPTY_IMAGE" }),      // bin 2, volume without particle
        img(13, [[3, 2, 50], [1, 1, null]]),                     // bin 2
    ]);
    const binned = computeBinnedSample(UVP6, records, { axis: "depth", step: 5 });

    test("writes every bin from the first image to the last, the empty one included (M5)", () => {
        expect(binned.bins.map((b) => [b.index, b.depth_start_m, b.depth_stop_m])).toEqual([[0, 0, 5], [1, 5, 10], [2, 10, 15]]);
        expect(binned.bins[1]).toMatchObject({ nb_images: 0, nb_black_images: 0, water_volume_l: 0, time_start_ms: null, time_stop_ms: null });
    });

    test("only lit images add volume: a black image is counted apart, an over-exposed one adds nothing, an empty one adds its volume", () => {
        expect(binned.bins[0]).toMatchObject({ nb_images: 1, nb_black_images: 1, water_volume_l: 0.5 });
        expect(binned.bins[2]).toMatchObject({ nb_images: 2, nb_black_images: 0, water_volume_l: 1 });
        expect(binned.used_images).toBe(5);
    });

    test("counts the particles of lit images by size class and by pixel area", () => {
        expect(binned.bins[0].counts[17]).toBe(10);
        expect(binned.bins[0].counts[18]).toBe(4);
        expect(binned.bins[0]).toMatchObject({ count_1px: 10, count_2px: 4 });
        expect(binned.bins[2].counts[17]).toBe(1);
        expect(binned.bins[2].counts[19]).toBe(2);
    });

    test("sums the biovolume of each particle from its ESD", () => {
        const one_px = esdMm(1, 0.0023, 1.136);
        expect(binned.bins[0].biovolumes_mm3[17]).toBeCloseTo(10 * Math.pow(one_px / 2, 3) * 4 * Math.PI / 3, 15);
    });

    test("weights the mean grey by the particle count, ignoring blocks without grey", () => {
        expect(binned.bins[0].grey_sums[17] / binned.bins[0].grey_weights[17]).toBe(20);
        expect(binned.bins[2].grey_weights[17]).toBe(0);
        expect(binned.bins[2].grey_sums[19] / binned.bins[2].grey_weights[19]).toBe(50);
    });

    test("dates a depth bin with the first and last images that add volume", () => {
        expect(binned.bins[0]).toMatchObject({ time_start_ms: T0, time_stop_ms: T0 });
        expect(binned.bins[2]).toMatchObject({ time_start_ms: T0 + 3 * 60_000, time_stop_ms: T0 + 4 * 60_000 });
    });

    test("applies the depth offset and sets a negative depth to 0", () => {
        const offset = computeBinnedSample({ ...UVP6, depth_offset_m: 2 }, sequence([img(-0.5), img(4)]), { axis: "depth", step: 5 });
        expect(offset.bins.map((b) => [b.index, b.nb_images])).toEqual([[0, 1], [1, 1]]);
        const negative = computeBinnedSample(UVP6, sequence([img(-3)]), { axis: "depth", step: 5 });
        expect(negative.bins.map((b) => b.index)).toEqual([0]);
    });

    test("leaves out the images without pressure", () => {
        const binned_without_pressure = computeBinnedSample({ ...UVP6, is_depth_profile: false }, sequence([img(null, [[1, 3, 10]]), img(2)]), { axis: "depth", step: 5 });
        expect(binned_without_pressure.bins).toHaveLength(1);
        expect(binned_without_pressure.bins[0]).toMatchObject({ nb_images: 1, count_1px: 0 });
    });
});

describe("computeBinnedSample, image selection", () => {
    const yoyo = sequence([img(1, [[1, 1, 10]]), img(10, [[1, 1, 10]]), img(6, [[1, 1, 10]]), img(12, [[1, 1, 10]])]);

    test("the descent filter drops an image shallower than the deepest kept so far, when the project enables it", () => {
        const filtered = computeBinnedSample({ ...UVP6, descent_filter_enabled: true }, yoyo, { axis: "depth", step: 5 });
        expect(filtered.used_images).toBe(3);
        expect(filtered.bins.find((b) => b.index === 1)?.nb_images).toBe(0);

        const unfiltered = computeBinnedSample(UVP6, yoyo, { axis: "depth", step: 5 });
        expect(unfiltered.used_images).toBe(4);
        expect(unfiltered.bins.find((b) => b.index === 1)?.nb_images).toBe(1);
    });

    test("the descent filter never applies to a time series", () => {
        const time_series = computeBinnedSample({ ...UVP6, descent_filter_enabled: true, is_depth_profile: false }, yoyo, { axis: "depth", step: 5 });
        expect(time_series.used_images).toBe(4);
    });

    test("a UVP6 file is cut to the operator window by rank, a UVP5 pivot was cut at conversion", () => {
        const window = { filter_first_image: "100", filter_last_image: "101" };
        expect(computeBinnedSample({ ...UVP6, ...window }, yoyo, { axis: "depth", step: 5 }).used_images).toBe(2);

        const uvp5 = { ...UVP6, ...window, instrument_model: "UVP5HD", aa: 0.0026, exp: 1.2284 };
        expect(computeBinnedSample(uvp5, yoyo, { axis: "depth", step: 5 }).used_images).toBe(4);
    });

    test("particles below the minimum area are left out and counted", () => {
        const uvp5 = { ...UVP6, instrument_model: "UVP5HD", aa: 0.0026, exp: 1.2284, particle_minimum_area_px: 2 };
        const binned = computeBinnedSample(uvp5, sequence([img(1, [[1, 7, 10], [2, 3, 20]])]), { axis: "depth", step: 5 });
        expect(binned.particles_below_minimum_area).toBe(7);
        expect(binned.bins[0]).toMatchObject({ count_1px: 0, count_2px: 3 });
        expect(binned.minimum_area_px).toBe(2);
        expect(binned.black_images_recorded).toBe(false);
    });
});

describe("computeBinnedSample, bin bounds and range", () => {
    test("with a decimal step, an image lying on a bound falls in the bin that starts there", () => {
        const depth = computeBinnedSample(UVP6, sequence([img(3.3)]), { axis: "depth", step: 1.1 });
        expect(depth.bins.map((b) => [b.index, b.depth_start_m, b.depth_stop_m])).toEqual([[3, 3.3, 4.4]]);

        const origin = Date.UTC(2024, 5, 12, 10, 0, 0);
        const records = sequence([img(1, [], { image_time_ms: origin }), img(1, [], { image_time_ms: origin + 34.4 * 3_600_000 })]);
        const time = computeBinnedSample({ ...UVP6, is_depth_profile: false }, records, { axis: "time", step: 0.8 });
        expect(time.bins[time.bins.length - 1]).toMatchObject({ index: 43, time_start_ms: origin + 34.4 * 3_600_000 });
    });

    test("a black or over-exposed image widens the range without adding volume", () => {
        const binned = computeBinnedSample(UVP6, sequence([img(1, [[1, 2, 10]]), img(20, [[1, 9, 10]], { light_on: false })]), { axis: "depth", step: 5 });
        expect(binned.bins.map((b) => [b.index, b.nb_images, b.nb_black_images, b.water_volume_l])).toEqual([[0, 1, 0, 0.5], [1, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 0], [4, 0, 1, 0]]);
    });

    test("a stray image time that would need more bins than allowed fails with the sample's name", () => {
        const records = sequence([
            img(1, [], { image_time_ms: Date.UTC(2000, 0, 1) }),
            img(1, [], { image_time_ms: Date.UTC(2024, 5, 12) }),
        ]);
        expect(() => computeBinnedSample({ ...UVP6, is_depth_profile: false }, records, { axis: "time", step: 0.5 }))
            .toThrow(/^Sample uvp6_sample would need \d+ time bins of 0\.5 h \(from 2000-01-01T00:00:00\.000Z to .*\), more than the 50000 a sample may have/);
    });

    test("a stray pressure fails the same way", () => {
        expect(() => computeBinnedSample(UVP6, sequence([img(1), img(99999)]), { axis: "depth", step: 1 }))
            .toThrow("Sample uvp6_sample would need 99999 depth bins of 1 m (from 1 m to 100000 m)");
    });
    test("the bin range is checked from the first pass, before any particle is read", () => {
        const records = sequence([img(1), img(99999)]);
        expect(() => new BinnedSampleBuilder(UVP6, toPerImageColumns(records), { axis: "depth", step: 1 }))
            .toThrow("Sample uvp6_sample would need 99999 depth bins of 1 m (from 1 m to 100000 m)");
    });
});

describe("BinnedSampleBuilder, two passes over the pivot", () => {
    const records = sequence([img(1, [[1, 7, 10]]), img(2, [[2, 3, 20]]), img(3, [[3, 1, 30]])]);

    test("gives the bins of computeBinnedSample, the rows bringing only their blocks", () => {
        const builder = new BinnedSampleBuilder(UVP6, toPerImageColumns(records), { axis: "depth", step: 1 });
        // The second pass carries the blocks; position, time and flags come from the first pass.
        for (const record of records) builder.add({ ...record, raw_pressure: null, image_time_ms: null, light_on: false });

        expect(builder.finish()).toEqual(computeBinnedSample(UVP6, records, { axis: "depth", step: 1 }));
    });

    test("refuses a file that changed between the two passes", () => {
        const changedWhileRead = "The particle file of sample uvp6_sample changed while it was read. Relaunch the export.";
        const columns = toPerImageColumns(records);

        const other_row = new BinnedSampleBuilder(UVP6, columns, { axis: "depth", step: 1 });
        other_row.add(records[0]);
        expect(() => other_row.add(records[2])).toThrow(changedWhileRead);

        const fewer_rows = new BinnedSampleBuilder(UVP6, columns, { axis: "depth", step: 1 });
        records.slice(0, 2).forEach((record) => fewer_rows.add(record));
        expect(() => fewer_rows.finish()).toThrow(changedWhileRead);

        const more_rows = new BinnedSampleBuilder(UVP6, columns, { axis: "depth", step: 1 });
        records.forEach((record) => more_rows.add(record));
        expect(() => more_rows.add({ ...records[0], image_id: "img3" })).toThrow(changedWhileRead);
    });
});

describe("computeBinnedSample, time bins", () => {
    const at = (h: number, m: number) => Date.UTC(2024, 5, 12, h, m, 0);
    const records = sequence([
        img(2, [[1, 1, 10]], { image_time_ms: at(10, 20) }),
        img(4, [[1, 1, 10]], { image_time_ms: at(10, 50) }),
        img(8, [[1, 1, 10]], { image_time_ms: at(10, 55) }),
        img(9, [[1, 1, 10]], { image_time_ms: null }),
        img(3, [[1, 1, 10]], { image_time_ms: at(11, 40) }),
    ]);
    const binned = computeBinnedSample({ ...UVP6, is_depth_profile: false }, records, { axis: "time", step: 0.5 });

    test("bins start at the UTC hour of the first image, an image without time is left out", () => {
        expect(binned.bins.map((b) => [b.index, b.nb_images])).toEqual([[0, 1], [1, 2], [2, 0], [3, 1]]);
        expect(binned.bins[1]).toMatchObject({ time_start_ms: at(10, 30), time_stop_ms: at(11, 0) });
    });

    test("the origin is the hour of the first image used, not of an image the window leaves out", () => {
        const windowed = sequence([
            img(2, [], { image_time_ms: at(11, 10) }),
            img(2, [], { image_time_ms: at(11, 20) }),
            img(2, [], { image_time_ms: at(9, 0) }),     // rank 102, past endimg
        ]);
        const binned_window = computeBinnedSample({ ...UVP6, is_depth_profile: false, filter_first_image: "100", filter_last_image: "101" }, windowed, { axis: "time", step: 1 });
        expect(binned_window.bins.map((b) => [b.index, b.time_start_ms])).toEqual([[0, at(11, 0)]]);
    });

    test("a time bin carries the mean depth of its images and no lower bound", () => {
        expect(binned.bins[1]).toMatchObject({ depth_start_m: 6, depth_stop_m: null });
        expect(binned.bins[2].depth_start_m).toBeNull();
    });
});

describe("particles.tsv", () => {
    const records = sequence([
        img(1, [[1, 10, 20], [2, 4, 30]]),
        img(3, [[1, 5, 10]], { light_on: false }),
        img(12, [[3, 2, 50], [1, 1, null]]),
    ]);
    const binned = computeBinnedSample(UVP6, records, { axis: "depth", step: 5 });
    const classes = [16, 17, 18, 19];
    const columns = particleColumns(classes);
    const rows = particleRows(42, binned, classes).map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));

    test("8 context columns, the rev 3 ones without the positions, then the pixel block (M1)", () => {
        expect(PARTICLE_CONTEXT_COLUMNS).toEqual([
            "ecopart_sample_id",
            "subsample_utc_date_time_start",
            "subsample_utc_date_time_stop",
            "subsample_depth_start",
            "subsample_depth_stop",
            "subsample_nb_images",
            "subsample_water_volume",
            "subsample_qcflag",
        ]);
        expect(PIXEL_COLUMNS).toEqual(["count_1px", "count_2px", "nb_black_images"]);
    });

    test("columns: context, pixel counts, then one block per quantity with one column per class", () => {
        expect(columns.slice(0, PARTICLE_CONTEXT_COLUMNS.length + PIXEL_COLUMNS.length)).toEqual([...PARTICLE_CONTEXT_COLUMNS, ...PIXEL_COLUMNS]);
        expect(columns).toContain("count_40p3um_50p8um");
        expect(columns).toContain("concentration_50p8um_64um");
        expect(columns).toContain("qcflag_80p6um_102um");
        expect(columns.length).toBe(PARTICLE_CONTEXT_COLUMNS.length + PIXEL_COLUMNS.length + 5 * classes.length);
    });

    test("a sampled bin carries counts, concentrations, biovolumes and mean grey", () => {
        expect(rows[0]).toMatchObject({
            ecopart_sample_id: "42",
            subsample_depth_start: "0",
            subsample_depth_stop: "5",
            subsample_nb_images: "1",
            nb_black_images: "1",
            subsample_water_volume: "0.5",
            subsample_qcflag: "0",
            count_1px: "10",
            count_2px: "4",
            count_50p8um_64um: "10",
            concentration_50p8um_64um: "20",
            intensity_50p8um_64um: "20",
            qcflag_50p8um_64um: "0",
            count_80p6um_102um: "0",
            concentration_80p6um_102um: "0",
            intensity_80p6um_102um: "NA",
        });
        expect(Number(rows[0].biovolume_50p8um_64um)).toBeCloseTo(binned.bins[0].biovolumes_mm3[17] / 0.5, 12);
    });

    test("a class the sample cannot see is NA in every block", () => {
        for (const block of ["count", "concentration", "biovolume", "intensity", "qcflag"]) {
            expect(rows[0][`${block}_40p3um_50p8um`]).toBe("NA");
        }
    });

    test("a bin without imaged volume is NA in its size-class cells, with a zero volume", () => {
        expect(rows[1]).toMatchObject({
            subsample_nb_images: "0",
            subsample_water_volume: "0",
            subsample_utc_date_time_start: "",
            count_1px: "NA",
            count_50p8um_64um: "NA",
            concentration_50p8um_64um: "NA",
            qcflag_50p8um_64um: "0",
        });
    });

    test("a mean grey with no grey to average is NA while the count stays", () => {
        expect(rows[2]).toMatchObject({ count_50p8um_64um: "1", intensity_50p8um_64um: "NA", intensity_80p6um_102um: "50" });
    });

    test("a UVP5 has no black image column value and no 1 px count below its minimum area", () => {
        const uvp5 = { ...UVP6, instrument_model: "UVP5HD", aa: 0.0026, exp: 1.2284, particle_minimum_area_px: 2 };
        const uvp5_binned = computeBinnedSample(uvp5, sequence([img(1, [[2, 3, 20]])]), { axis: "depth", step: 5 });
        const row = Object.fromEntries(columns.map((c, i) => [c, particleRows(1, uvp5_binned, classes)[0][i]]));
        expect(row).toMatchObject({ nb_black_images: "NA", count_1px: "NA", count_2px: "3" });
    });

    test("the exported classes are the union of the classes visible on each sample", () => {
        const uvp6 = visibleSizeClasses(0.0023, 1.136, 1);
        const uvp5z = visibleSizeClasses(0.0014, 1.397, 1);
        const union = exportedSizeClasses([uvp6, uvp5z]);
        expect(union[0]).toBe(16);
        expect(union).toContain(17);
        expect(union).toHaveLength(29);
        expect(exportedSizeClasses([uvp5z])).not.toContain(17);
    });

    test("numbers keep twelve significant digits", () => {
        expect(formatNumber(0.1 + 0.2)).toBe("0.3");
        expect(formatNumber(1 / 3)).toBe("0.333333333333");
        expect(formatNumber(20)).toBe("20");
    });
});
