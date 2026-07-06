import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";

// The QC-graph parsers are pure (no IO), so a dummy datasource is fine.
const repo = new SampleRepositoryImpl({} as any, "");

describe("parseParticulesCsvRecords (UVP6)", () => {
    test("parses per-image rows: pressure, light flag and the pixel-class spectrum", () => {
        const content = [
            "HW_CONF,000213LP,0,UNDEFINED,0,000226VE2", // header — skipped
            "ACQ_CONF,ACQ_SUP_01,2,2.000",              // header — skipped
            "20240612-003906-1,3.13,15,1:1,5117,29.3,10.5;2,498,36.5,16.9;3,101,43.4,24.0;4,38,49.0,27.1",
            "20240612-003907-1,3.20,15,0:1,7,29.3,10.5;2,3,36.5,16.9", // black (lights off)
        ].join("\n");

        const records = repo.parseParticulesCsvRecords(content);

        expect(records).toHaveLength(2);

        // Lit row: block 0's class is the "1" glued into the "1:1" flag, count is its first field.
        expect(records[0]).toEqual({
            image_index: 0,
            image_id: "20240612-003906-1",
            raw_pressure: 3.13,
            light_on: true,
            spectrum_counts: { 1: 5117, 2: 498, 3: 101, 4: 38 },
        });

        // Black row: flag "0:1" → light off; later blocks carry their own class index.
        expect(records[1].light_on).toBe(false);
        expect(records[1].image_index).toBe(1);
        expect(records[1].spectrum_counts).toEqual({ 1: 7, 2: 3 });
    });
});

describe("parseDatfileFrames (UVP5)", () => {
    test("reads frame index (col 0) and raw pressure (col 2)", () => {
        const content = [
            "     9;\t20120520080214_203;\t00150;00356;00356;",
            "    10;\t20120520080214_296;\t00151;00356;00356;",
        ].join("\n");

        const frames = repo.parseDatfileFrames(content);

        expect(frames).toEqual([
            { frame_idx: 9, raw_pressure: 150 },
            { frame_idx: 10, raw_pressure: 151 },
        ]);
    });
});

describe("parseBruSpectraByFrame (UVP5 .bru)", () => {
    test("counts particles per pixel area, grouped by frame index", () => {
        const content = [
            "52;\t0;\t68;\t60;\t368;\t835",
            "52;\t1;\t68;\t10;\t1;\t2",
            "53;\t0;\t12;\t5;\t1;\t1",
        ].join("\n");

        const byFrame = repo.parseBruSpectraByFrame(content);

        expect(byFrame.get(52)).toEqual({ 68: 2 });
        expect(byFrame.get(53)).toEqual({ 12: 1 });
    });
});
