import { PivotImageRecord, PivotParticleBlock } from "../../../../src/domain/entities/binned-export";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";
import {
    BinnedSampleBuilder,
    BinnedSampleSettings,
    computeBinnedSample,
    esdMm,
    exportedSizeClasses,
    formatNumber,
    minimumAreaPx,
    particleCells,
    particleColumns,
    particleRows,
    particleNoValueColumns,
    particleTableColumns,
    PARTICLE_CONTEXT_COLUMNS,
    PARTICLE_NOT_APPLICABLE_COLUMNS,
    PIXEL_COLUMNS,
    visibleSizeClasses,
} from "../../../../src/domain/use-cases/export/binned-computation";
import { serialize } from "../../../../src/domain/use-cases/export/tsv";
import { selectUsedImages } from "../../../../src/domain/use-cases/sample/qc-graphs-builder";

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

// A UVP6 with aa 0.0023 mm²/px (Aa 2300 in its metadata.ini) and Exp 1.136: 1 px falls in class 17 (50.8-64 µm), 2 px in 18, 3 px in 19.
const UVP6: BinnedSampleSettings = {
    sample_name: "uvp6_sample",
    instrument_model: "UVP6LP",
    is_depth_profile: true,
    descent_filter_enabled: false,
    filter_first_image: null,
    filter_last_image: null,
    depth_offset_m: 0,
    image_volume_l: 0.5,
    aa: 0.0023,
    exp: 1.136,
    particle_minimum_area_px: null,
};

const firstVisible = (visible: boolean[]) => visible.indexOf(true);
const invisibleAfterFirst = (visible: boolean[]) => visible.flatMap((v, i) => (!v && i > firstVisible(visible) ? [i] : []));

describe("calibration", () => {
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
        const records = sequence([img(1, [], { image_time_ms: origin }), img(1, [], { image_time_ms: origin + 34.5 * 3_600_000 })]);
        const time = computeBinnedSample({ ...UVP6, is_depth_profile: false }, records, { axis: "time", step: 0.5 });
        expect(time.bins[time.bins.length - 1]).toMatchObject({ index: 69, time_start_ms: origin + 34.5 * 3_600_000 });
    });

    test("time bins are aligned on midnight UTC: the same bounds for every sample, a 24 h bin is a calendar day", () => {
        const at = (hours: number, minutes: number) => Date.UTC(2024, 5, 12, hours, minutes, 0);
        const bounds = (first_image_ms: number, step: number) => {
            const binned = computeBinnedSample({ ...UVP6, is_depth_profile: false }, sequence([img(1, [], { image_time_ms: first_image_ms })]), { axis: "time", step });
            return binned.bins.map((b) => [new Date(b.time_start_ms as number).toISOString(), new Date(b.time_stop_ms as number).toISOString()]);
        };
        expect(bounds(at(13, 20), 6)).toEqual([["2024-06-12T12:00:00.000Z", "2024-06-12T18:00:00.000Z"]]);
        expect(bounds(at(8, 5), 6)).toEqual([["2024-06-12T06:00:00.000Z", "2024-06-12T12:00:00.000Z"]]);
        expect(bounds(at(13, 20), 24)).toEqual([["2024-06-12T00:00:00.000Z", "2024-06-13T00:00:00.000Z"]]);
        // A 1 h step keeps the UTC hours of the legacy and the QC graphs.
        expect(bounds(at(13, 20), 1)).toEqual([["2024-06-12T13:00:00.000Z", "2024-06-12T14:00:00.000Z"]]);
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
    test("the range is measured to the end of the file, the bins being dropped once it exceeds the limit", () => {
        const builder = new BinnedSampleBuilder(UVP6, { axis: "depth", step: 1 });
        sequence([img(1, [[1, 7, 10]]), img(99999, [[1, 7, 10]]), img(50000, [[1, 7, 10]])]).forEach((record) => builder.add(record));
        expect(() => builder.finish()).toThrow("Sample uvp6_sample would need 99999 depth bins of 1 m (from 1 m to 100000 m)");
    });
});

describe("BinnedSampleBuilder, one pass over the pivot", () => {
    const records = sequence([img(1, [[1, 7, 10]]), img(2, [[2, 3, 20]]), img(3, [[3, 1, 30]]), img(4, [[1, 2, 40]])]);
    const binsOf = (settings: Partial<BinnedSampleSettings>, rows = records) =>
        computeBinnedSample({ ...UVP6, ...settings }, rows, { axis: "depth", step: 1 }).bins.map((b) => [b.index, b.nb_images, b.counts[17] + b.counts[18] + b.counts[19]]);
    const usedOf = (settings: Partial<BinnedSampleSettings>, rows = records) => computeBinnedSample({ ...UVP6, ...settings }, rows, { axis: "depth", step: 1 }).used_images;

    test("counts the rows of the file and the images with a position on the axis, used or not", () => {
        const rows = sequence([img(1, [], { image_time_ms: null }), img(null), img(2, [], { light_on: false }), img(null, [], { image_time_ms: null })]);
        // Ranks 0 to 3: endimg 0 keeps the first row only
        const depth = computeBinnedSample({ ...UVP6, filter_last_image: "0" }, rows, { axis: "depth", step: 1 });
        expect([depth.total_images, depth.positioned_images, depth.used_images]).toEqual([4, 2, 1]);
        const time = computeBinnedSample({ ...UVP6, is_depth_profile: false }, rows, { axis: "time", step: 1 });
        expect([time.total_images, time.positioned_images, time.used_images]).toEqual([4, 2, 4]);
    });

    test("a bound naming an image id starts the window at its first occurrence and ends it at its last one", () => {
        expect(binsOf({ filter_first_image: "img1" })).toEqual([[2, 1, 3], [3, 1, 1], [4, 1, 2]]);
        expect(binsOf({ filter_last_image: "img2" })).toEqual([[1, 1, 7], [2, 1, 3], [3, 1, 1]]);
        expect(binsOf({ filter_first_image: "img1", filter_last_image: "img2" })).toEqual([[2, 1, 3], [3, 1, 1]]);
        // The id occurring twice: the window ends at the last occurrence
        const twice = records.map((record, i) => (i === 1 || i === 3 ? { ...record, image_id: "dup" } : record));
        expect(binsOf({ filter_last_image: "dup" }, twice)).toEqual([[1, 1, 7], [2, 1, 3], [3, 1, 1], [4, 1, 2]]);
        expect(binsOf({ filter_last_image: "dup" }, twice.slice(0, 3))).toEqual([[1, 1, 7], [2, 1, 3]]);
    });

    test("an id that never occurs leaves its end of the window open", () => {
        expect(usedOf({ filter_first_image: "nope" })).toBe(4);
        expect(usedOf({ filter_last_image: "nope" })).toBe(4);
        expect(binsOf({ filter_first_image: "nope", filter_last_image: "nope" })).toEqual([[1, 1, 7], [2, 1, 3], [3, 1, 1], [4, 1, 2]]);
    });

    test("endimg before firstimage: nothing is used, unless endimg occurs again after it", () => {
        expect(usedOf({ filter_first_image: "img2", filter_last_image: "img0" })).toBe(0);
        expect(binsOf({ filter_first_image: "img2", filter_last_image: "img0" })).toEqual([]);
        const again = records.map((record, i) => (i === 0 || i === 3 ? { ...record, image_id: "dup" } : record));
        expect(binsOf({ filter_first_image: "img2", filter_last_image: "dup" }, again)).toEqual([[3, 1, 1], [4, 1, 2]]);
    });

    test("the descent filter starts over from firstimage", () => {
        const yoyo = sequence([img(5, [[1, 1, 10]]), img(2, [[1, 1, 10]]), img(3, [[1, 1, 10]]), img(1, [[1, 1, 10]])]);
        expect(usedOf({ descent_filter_enabled: true }, yoyo)).toBe(1);
        expect(usedOf({ descent_filter_enabled: true, filter_first_image: "img1" }, yoyo)).toBe(2);
    });

    test("the rows added after the last occurrence of endimg change nothing", () => {
        const builder = new BinnedSampleBuilder({ ...UVP6, filter_last_image: "img1" }, { axis: "depth", step: 1 });
        records.forEach((record) => builder.add(record));
        const finished = builder.finish();
        const up_to_endimg = computeBinnedSample(UVP6, records.slice(0, 2), { axis: "depth", step: 1 });
        expect([finished.used_images, finished.particles_below_minimum_area, finished.bins]).toEqual([up_to_endimg.used_images, up_to_endimg.particles_below_minimum_area, up_to_endimg.bins]);
        // The file itself is counted whole
        expect([finished.total_images, finished.positioned_images]).toEqual([4, 4]);
    });

    /* The images used are those the QC graphs select: random files and windows, the selection of
     * `selectUsedImages` over the columns (two passes) against the builder's single pass. */
    test("uses exactly the images the QC graphs select, on 300 random files and windows", () => {
        const PRIME = 2654435761;
        for (let seed = 1; seed <= 300; seed++) {
            let x = seed;
            const rnd = () => { x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff; return x / 0x80000000; };
            const pick = <T,>(items: T[]): T => items[Math.floor(rnd() * items.length)];
            const n = 1 + Math.floor(rnd() * 12);
            let time = Date.UTC(2024, 5, 12, 10, 20, 0);
            const rows: PivotImageRecord[] = [];
            for (let i = 0; i < n; i++) {
                time += Math.floor(rnd() * 90) * 60_000;
                const blocks: Array<[number, number, number | null]> = Array.from({ length: Math.floor(rnd() * 3) }, () => [1 + Math.floor(rnd() * 5), 1 + Math.floor(rnd() * 9), 30]);
                rows.push(img(rnd() < 0.1 ? null : Math.round((rnd() * 32 - 2) * 10) / 10, blocks, {
                    image_index: i, image_id: `img${i}`, image_time_ms: rnd() < 0.1 ? null : time, light_on: rnd() < 0.8,
                    particle_data_flag: pick<PivotImageRecord["particle_data_flag"]>([undefined, undefined, undefined, undefined, "OVER_EXPOSED", "EMPTY_IMAGE"]),
                }));
            }
            const dup = [Math.floor(rnd() * n), Math.floor(rnd() * n)];
            if (rnd() < 0.3) dup.forEach((i) => { rows[i] = { ...rows[i], image_id: "dup" }; });
            const bound = (): string | null => pick([null, null, "100", `${100 + Math.floor(rnd() * n)}`, `img${Math.floor(rnd() * n)}`, "dup", "nope"]);
            const uvp5 = rnd() < 0.2;
            const settings: BinnedSampleSettings = {
                ...UVP6, instrument_model: uvp5 ? "UVP5HD" : "UVP6LP", aa: 0.0023,
                is_depth_profile: rnd() < 0.6, descent_filter_enabled: rnd() < 0.5, filter_first_image: bound(), filter_last_image: bound(),
                depth_offset_m: pick([0, 1.2, null]),
            };
            const axis = rnd() < 0.6 ? "depth" : "time";
            const step = axis === "depth" ? pick([1, 2.5, 5]) : pick([0.5, 1, 2]);

            const selected = selectUsedImages({
                sample_id: null, sample_name: "s", instrument_model: "UVP6", visual_qc_status_label: "",
                filter_first_image: uvp5 ? null : settings.filter_first_image, filter_last_image: uvp5 ? null : settings.filter_last_image,
                instrument_settings_depth_offset_m: settings.depth_offset_m, instrument_settings_image_volume_l: settings.image_volume_l,
                is_depth_profile: settings.is_depth_profile, descent_filter_enabled: settings.descent_filter_enabled, records: toPerImageColumns(rows),
            });
            const step_units = Math.round(step * (axis === "depth" ? 1_000_000 : 3_600_000));
            const times = rows.filter((_, k) => selected[k] === 1).map((r) => r.image_time_ms).filter((t): t is number => t !== null);
            const origin = times.length > 0 ? Math.floor(Math.min(...times) / step_units) * step_units : null;
            const binOf = (r: PivotImageRecord): number | null => axis === "depth"
                ? (r.raw_pressure === null ? null : Math.floor(Math.round(Math.max(0, r.raw_pressure + (settings.depth_offset_m ?? 0)) * 1_000_000) / step_units))
                : (r.image_time_ms === null || origin === null ? null : Math.floor((r.image_time_ms - origin) / step_units));
            const by_bin = new Map<number, [number, number]>();
            rows.forEach((r, k) => {
                const bin = selected[k] === 1 ? binOf(r) : null;
                if (bin === null) return;
                const counts = by_bin.get(bin) ?? [0, 0];
                if (!r.light_on) counts[1]++;
                else if (r.particle_data_flag !== "OVER_EXPOSED") counts[0]++;
                by_bin.set(bin, counts);
            });
            const indexes = [...by_bin.keys()];
            const expected_bins: number[][] = [];
            if (indexes.length > 0) {
                for (let index = Math.min(...indexes); index <= Math.max(...indexes); index++) expected_bins.push([index, ...(by_bin.get(index) ?? [0, 0])]);
            }
            const expected = { seed, used: selected.reduce((sum, s) => sum + s, 0), bins: expected_bins };

            const binned = computeBinnedSample(settings, rows, { axis, step });
            const actual = { seed, used: binned.used_images, bins: binned.bins.map((b) => [b.index, b.nb_images, b.nb_black_images]) };
            expect(actual).toEqual(expected);
        }
        expect(PRIME).toBeGreaterThan(0);
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

    test("bins are counted from the bin of the first image, an image without time is left out", () => {
        expect(binned.bins.map((b) => [b.index, b.nb_images])).toEqual([[0, 1], [1, 2], [2, 0], [3, 1]]);
        expect(binned.bins[1]).toMatchObject({ time_start_ms: at(10, 30), time_stop_ms: at(11, 0) });
    });

    test("an image used that comes earlier than the first one falls in a bin of negative index", () => {
        const backwards = sequence([img(2, [[1, 1, 10]], { image_time_ms: at(10, 20) }), img(2, [[1, 1, 10]], { image_time_ms: at(9, 50) })]);
        const binned_backwards = computeBinnedSample({ ...UVP6, is_depth_profile: false }, backwards, { axis: "time", step: 1 });
        expect(binned_backwards.bins.map((b) => [b.index, b.time_start_ms, b.nb_images])).toEqual([[-1, at(9, 0), 1], [0, at(10, 0), 1]]);
    });

    test("the origin is the bin of the first image used, not of an image the window leaves out", () => {
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

    test("9 context columns: the rev 3 ones without the positions, plus the axis of the bin, then the pixel block (M1)", () => {
        expect(PARTICLE_CONTEXT_COLUMNS).toEqual([
            "ecopart_sample_id",
            "subsample_bin_type",
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

    test("typed cells: numbers and dates, null for an empty cell, NA where no value exists; the TSV row is their text", () => {
        const typed = (bin_index: number) => Object.fromEntries(columns.map((c, i) => [c, particleCells(42, binned, binned.bins[bin_index], classes)[i]]));

        expect(typed(0)).toMatchObject({
            ecopart_sample_id: 42,
            subsample_depth_start: 0,
            subsample_depth_stop: 5,
            subsample_nb_images: 1,
            subsample_water_volume: 0.5,
            subsample_qcflag: 0,
            count_1px: 10,
            count_50p8um_64um: 10,
            concentration_50p8um_64um: 20,
            intensity_50p8um_64um: 20,
            intensity_80p6um_102um: "NA",
            count_40p3um_50p8um: "NA",
        });
        expect(typed(0).subsample_utc_date_time_start).toEqual(new Date(T0));
        expect(typed(1)).toMatchObject({ subsample_utc_date_time_start: null, subsample_water_volume: 0, count_1px: "NA", count_50p8um_64um: "NA" });
        for (const bin of binned.bins) {
            const cells = particleCells(42, binned, bin, classes);
            expect(particleRows(42, binned, classes)[bin.index]).toEqual(cells.map((cell) => serialize(cell, formatNumber)));
        }
    });

    test("no column holds both kinds of absence: null only where the column does not apply, NA only where no value exists", () => {
        const uvp5 = { ...UVP6, instrument_model: "UVP5HD", aa: 0.0026, exp: 1.2284, particle_minimum_area_px: 2 };
        const samples = [
            // Depth bins with an empty bin: times without value, pixel and class cells NA.
            binned,
            // Time bins with a bin left without images: no mean depth there, never a depth stop.
            computeBinnedSample({ ...UVP6, is_depth_profile: false }, sequence([
                img(2, [[1, 1, 10]], { image_time_ms: Date.UTC(2024, 5, 12, 10, 20, 0) }),
                img(3, [[1, 1, 10]], { image_time_ms: Date.UTC(2024, 5, 12, 11, 40, 0) }),
            ]), { axis: "time", step: 0.5 }),
            // A UVP5: no black image count, no 1 px count below its minimum area.
            computeBinnedSample(uvp5, sequence([img(1, [[2, 3, 20]])]), { axis: "depth", step: 5 }),
        ];
        const empty_in = new Set<string>();
        const na_in = new Set<string>();
        for (const sample of samples) {
            for (const bin of sample.bins) {
                particleCells(1, sample, bin, classes).forEach((cell, i) => {
                    if (cell === null) empty_in.add(columns[i]);
                    if (cell === "NA") na_in.add(columns[i]);
                });
            }
        }

        expect([...empty_in]).toEqual(expect.arrayContaining(["subsample_utc_date_time_start", "subsample_utc_date_time_stop", "subsample_depth_start", "subsample_depth_stop"]));
        expect([...na_in]).toEqual(expect.arrayContaining(["count_1px", "nb_black_images", "count_40p3um_50p8um", "intensity_80p6um_102um"]));
        expect([...empty_in].filter((c) => !PARTICLE_NOT_APPLICABLE_COLUMNS.includes(c))).toEqual([]);
        expect([...na_in].filter((c) => !particleNoValueColumns(classes).includes(c))).toEqual([]);
        expect(PARTICLE_NOT_APPLICABLE_COLUMNS.filter((c) => particleNoValueColumns(classes).includes(c))).toEqual([]);
        expect([...PARTICLE_NOT_APPLICABLE_COLUMNS, ...particleNoValueColumns(classes)].every((c) => columns.includes(c))).toBe(true);
    });

    test("column types: identifiers, counts and flags are integers, measures doubles, bin times timestamps", () => {
        const types = Object.fromEntries(particleTableColumns(classes).map((c) => [c.name, c.type]));

        expect(particleTableColumns(classes).map((c) => c.name)).toEqual(columns);
        expect(types).toMatchObject({
            ecopart_sample_id: "integer",
            subsample_utc_date_time_start: "timestamp",
            subsample_utc_date_time_stop: "timestamp",
            subsample_depth_start: "double",
            subsample_nb_images: "integer",
            subsample_water_volume: "double",
            subsample_qcflag: "integer",
            count_1px: "integer",
            nb_black_images: "integer",
            count_50p8um_64um: "integer",
            concentration_50p8um_64um: "double",
            biovolume_50p8um_64um: "double",
            intensity_50p8um_64um: "double",
            qcflag_50p8um_64um: "integer",
        });
    });

    test("numbers keep twelve significant digits", () => {
        expect(formatNumber(0.1 + 0.2)).toBe("0.3");
        expect(formatNumber(1 / 3)).toBe("0.333333333333");
        expect(formatNumber(20)).toBe("20");
    });
});
