import { PerImageRecord } from "../../../src/domain/entities/sample-qc-graph";
import { MAX_PER_IMAGE_RECORDS, PerImageColumnsBuilder, toPerImageColumns } from "../../../src/domain/utils/per-image-columns";
import { recordsOf } from "../../entities/per-image-records";

const record = (k: number, overrides: Partial<PerImageRecord> = {}): PerImageRecord => ({
    image_index: k,
    image_id: `20250118-0000${String(k % 100).padStart(2, "0")}-${k}`,
    raw_pressure: k / 10,
    image_time_ms: Date.UTC(2025, 0, 18) + k * 1000,
    light_on: true,
    spectrum_counts: { 1: k % 7, 2: 3, 3: 1 },
    ...overrides,
});

describe("per-image columns", () => {
    test("give back every field of the records, unreadable values included", () => {
        const records: PerImageRecord[] = [
            record(0),
            record(1, { raw_pressure: null, image_time_ms: null, light_on: false, spectrum_counts: {} }),
            record(2, { particle_data_flag: "OVER_EXPOSED", spectrum_counts: { 2: 4 } }),
            record(3, { image_id: "12", particle_data_flag: "EMPTY_IMAGE" }),
        ];

        expect(recordsOf(toPerImageColumns(records))).toEqual([
            { ...records[0], spectrum_counts: { 2: 3, 3: 1 } },
            records[1],
            records[2],
            records[3],
        ]);
    });

    test("keep only the 1, 2 and 3 pixel classes, the only ones the QC graphs read", () => {
        const columns = toPerImageColumns([record(0, { spectrum_counts: { 1: 5, 3: 2, 4: 9, 120: 1 } })]);

        expect(recordsOf(columns)[0].spectrum_counts).toEqual({ 1: 5, 3: 2 });
    });

    test("grow past their first allocation without losing a record", () => {
        const records = Array.from({ length: 50_000 }, (_, k) => record(k));

        const columns = toPerImageColumns(records);

        expect(columns.length).toBe(50_000);
        expect(recordsOf(columns)).toEqual(records.map(r => ({ ...r, spectrum_counts: Object.fromEntries(Object.entries(r.spectrum_counts).filter(([, n]) => n !== 0)) })));
    });

    test("refuse a sample beyond the record limit with a clear error", () => {
        const builder = new PerImageColumnsBuilder(3);
        for (let k = 0; k < 3; k++) builder.push(record(k));

        expect(() => builder.push(record(3))).toThrow("Sample has too many images to be read at once");
        expect(MAX_PER_IMAGE_RECORDS).toBe(30_000_000);
    });

    test("an empty sample gives empty columns", () => {
        const columns = toPerImageColumns([]);

        expect(columns.length).toBe(0);
        expect(recordsOf(columns)).toEqual([]);
    });
});
