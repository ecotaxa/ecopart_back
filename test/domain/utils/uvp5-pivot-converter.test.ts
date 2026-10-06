import { convertUvp5ToPivot, describeUvp5PivotReport, parseUvp5HeaderRow, Uvp5PivotInput, UVP5_PIVOT_CONVERTER_VERSION } from "../../../src/domain/utils/uvp5-pivot-converter";
import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";

// work/ datfile rows: frame; timestamp; 12-value sensor block ending with "!"; then object counts
// (columns 14 and 17 sum to the frame's .bru rows).
function datRow(frame: number, timestamp: string, pressure: string, small: number, large: number): string {
    return `    ${frame};\t${timestamp};\t${pressure};00182;00182;00039;02883;03037;01212;00942;00686;40944;22769;01557!;\t${small};\t4;\t12;\t${large};\t0;`;
}

const DATFILE = [
    datRow(10, "20200806221354_536", "00136", 3, 0),   // before firstimage
    datRow(12, "20200806221354_586", "00136", 3, 0),
    datRow(13, "20200806221354_636", "00137", 0, 0),   // no particle
    datRow(15, "20200806221354_736", "00140", 2, 1),   // index gap 13 → 15
].join("\r\n");

const BRU = [
    "10;0;4;20;1;1",
    "12;0;3;10;1;1",
    "12;1;2;30;1;1",
    "12;2;3;21;1;1",
    "15;0;2;40;1;1",
    "15;1;2;50;1;1",
    "15;2;80;100;1;1",
    "99;0;5;5;1;1",                                     // frame absent from the datfile
].join("\r\n");

const HEADER_ROW: Record<string, string> = {
    cruise: "sn222_hot321", profileid: "s1c1", latitude: "21.2238020", firstimage: "12",
    volimage: "1.2242", aa: "0.0026", exp: "1.2284", endimg: "9.9999999999E10", yoyo: "N", stationid: "Kahe",
};

function input(overrides: Partial<Uvp5PivotInput> = {}, sample_overrides: Record<string, unknown> = {}): Uvp5PivotInput {
    return {
        sample: {
            sample_name: "s1c1",
            filter_first_image: "12",
            filter_last_image: "9.9999999999E10",
            instrument_settings_aa: 0.0026,
            instrument_settings_exp: 1.2284,
            instrument_settings_image_volume_l: 1.2242,
            instrument_settings_pixel_size_mm: "0.093" as unknown as number,   // as parsed from uvp5_configuration_data.txt
            instrument_settings_acq_threshold: 3,
            instrument_settings_acq_gain: 200,
            instrument_settings_acq_exposure: 240,
            instrument_settings_particule_minimum_area_pixels: 2,
            ...sample_overrides,
        },
        instrument_model: "UVP5HD",
        datfile_content: DATFILE,
        bru_content: BRU,
        header_row: HEADER_ROW,
        converted_utc: "2026-10-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("convertUvp5ToPivot", () => {
    test("writes one UVP6 line per frame of the window, blocks sorted by area, grey_std empty", () => {
        const files = convertUvp5ToPivot(input());

        expect(files.particules_csv).toBe([
            "20200806-221354-586,13.6,,1:2,1,30.0,;3,2,15.5,",
            "20200806-221354-636,13.7,,1:",
            "20200806-221354-736,14.0,,1:2,2,45.0,;80,1,100.0,",
            "",
        ].join("\n"));
    });

    test("keeps the native frame index of each line in frames.csv, row-aligned with particules.csv", () => {
        const files = convertUvp5ToPivot(input());

        expect(files.frames_csv).toBe("image_id;frame_index\n20200806-221354-586;12\n20200806-221354-636;13\n20200806-221354-736;15\n");
    });

    test("reports the window cut, the empty frame and the .bru frame without pressure", () => {
        const { report } = convertUvp5ToPivot(input());

        expect(report).toEqual({
            sample_name: "s1c1",
            converter_version: UVP5_PIVOT_CONVERTER_VERSION,
            frames_written: 3,
            frames_outside_window: 1,
            empty_frames: 1,
            frames_without_pressure: 1,
            duplicate_image_ids: 0,
            integrity_mismatches: 0,
        });
        expect(describeUvp5PivotReport(report)).toBe("s1c1: 3 frames written, 1 outside [firstimage, endimg], 1 without particle, 1 .bru frames without pressure, 0 duplicate image ids, 0 integrity mismatches");
    });

    test("applies a numeric endimg and leaves a non-numeric bound open", () => {
        expect(convertUvp5ToPivot(input({}, { filter_last_image: "13" })).report.frames_written).toBe(2);
        expect(convertUvp5ToPivot(input({}, { filter_first_image: "start", filter_last_image: "" })).report.frames_written).toBe(4);
    });

    test("counts the frames whose datfile object counts disagree with the .bru", () => {
        const datfile = DATFILE.replace(datRow(15, "20200806221354_736", "00140", 2, 1), datRow(15, "20200806221354_736", "00140", 2, 0));

        expect(convertUvp5ToPivot(input({ datfile_content: datfile })).report.integrity_mismatches).toBe(1);
    });

    test("is deterministic: the same input gives byte-identical members", () => {
        const a = convertUvp5ToPivot(input());
        const b = convertUvp5ToPivot(input());

        expect(b.particules_csv).toBe(a.particules_csv);
        expect(b.metadata_ini).toBe(a.metadata_ini);
        expect(b.frames_csv).toBe(a.frames_csv);
    });

    test("reads the raw/ spelling of the sensor block, separated by '*'", () => {
        const datfile = "    12;\t20200806221354_586;\t00136*00182*00182*00039*02883*03037*01212*00942*00686*40944*22769*01557!;\t3;\t4;\t12;\t0;\t0;";

        const files = convertUvp5ToPivot(input({ datfile_content: datfile }));

        expect(files.particules_csv).toBe("20200806-221354-586,13.6,,1:2,1,30.0,;3,2,15.5,\n");
        expect(files.report.integrity_mismatches).toBe(0);
    });

    test("writes the documentary metadata.ini: UVP6 units, no Pressure_offset, provenance section", () => {
        const ini = convertUvp5ToPivot(input()).metadata_ini;

        expect(ini).toContain("[HW_CONF]\nAa=2600.000\nExp=1.2284\nGain=200\nImage_volume=1.2242\nPixel_Size=93\nShutter=240\nThreshold=3\n");
        expect(ini).not.toContain("Pressure_offset");
        // aa / exp / volimage moved to [HW_CONF], as in a UVP6 metadata.ini.
        expect(ini).toContain("[sample_metadata]\ncruise=sn222_hot321\nprofileid=s1c1\nlatitude=21.2238020\nfirstimage=12\nendimg=9.9999999999E10\nyoyo=N\nstationid=Kahe\n");
        expect(ini).toContain(`converter_version=${UVP5_PIVOT_CONVERTER_VERSION}\n`);
        expect(ini).toContain("converted_utc=2026-10-01T00:00:00.000Z\n");
        expect(ini).toContain("particle_minimum_area_px=2\n");
        expect(ini).toContain("window_applied=[12, 9.9999999999E10]\n");
        expect(ini).toContain("frames_without_pressure=1\n");
    });

    test("ignores a malformed frame outside the window", () => {
        const datfile = DATFILE.replace("20200806221354_536", "garbage");

        expect(convertUvp5ToPivot(input({ datfile_content: datfile })).report.frames_written).toBe(3);
    });

    describe("explicit errors naming the fix", () => {
        test("a frame of the window with an unreadable timestamp", () => {
            const datfile = DATFILE.replace("20200806221354_636", "2020-08-06");

            expect(() => convertUvp5ToPivot(input({ datfile_content: datfile }))).toThrow(
                'frame 13 of s1c1_datfile.txt has the timestamp "2020-08-06" instead of YYYYMMDDHHMMSS_mmm. Correct this line of the datfile, then relaunch the import or the pivot regeneration.');
        });

        test("a frame of the window with an unreadable pressure", () => {
            const datfile = DATFILE.replace("00137", "abc");

            expect(() => convertUvp5ToPivot(input({ datfile_content: datfile }))).toThrow(
                'frame 13 of s1c1_datfile.txt has no readable pressure ("abc"). Correct this line of the datfile, then relaunch the import or the pivot regeneration.');
        });

        test("no frame inside [firstimage, endimg]", () => {
            expect(() => convertUvp5ToPivot(input({}, { filter_first_image: "500" }))).toThrow(
                "no frame of s1c1_datfile.txt lies inside [firstimage, endimg] = [500, 9.9999999999E10]. Correct firstimage / endimg of the sample in the meta header, then relaunch the import or the pivot regeneration.");
        });

        test("an empty datfile", () => {
            expect(() => convertUvp5ToPivot(input({ datfile_content: "" }))).toThrow(
                "s1c1_datfile.txt contains no frame. Check the work folder of the sample, then relaunch the import or the pivot regeneration.");
        });
    });
});

describe("pivot read back by the UVP6 reader", () => {
    const repo = new SampleRepositoryImpl({} as any, "");

    test("gives, frame by frame, the native counts, the pressure in decibar and a lit image", () => {
        const files = convertUvp5ToPivot(input());
        const pivot = repo.parseParticulesCsvRecords(files.particules_csv);
        const native_frames = repo.parseDatfileFrames(DATFILE).filter((f) => f.frame_idx >= 12);
        const native_spectra = repo.parseBruSpectraByFrame(BRU);

        expect(pivot).toHaveLength(native_frames.length);
        pivot.forEach((record, i) => {
            const frame = native_frames[i];
            expect(record.spectrum_counts).toEqual(native_spectra.get(frame.frame_idx) ?? {});
            // Already in decibar: a reader must not apply the UVP5 gain (0.1) a second time.
            expect(record.raw_pressure).toBeCloseTo(frame.raw_pressure * 0.1, 9);
            expect(record.image_time_ms).toBe(frame.time_ms);
            expect(record.light_on).toBe(true);
        });
    });

    test("reads a frame without particle as a lit image with an empty spectrum", () => {
        const pivot = repo.parseParticulesCsvRecords(convertUvp5ToPivot(input()).particules_csv);

        expect(pivot[1]).toEqual(expect.objectContaining({ image_id: "20200806-221354-636", light_on: true, spectrum_counts: {} }));
    });
});

describe("parseUvp5HeaderRow", () => {
    const header = "cruise;profileid;firstimage\r\nc1;s0;1\r\nc1;s1c1;3907\r\n";

    test("returns the sample's row, columns in file order", () => {
        const row = parseUvp5HeaderRow(header, "s1c1");

        expect(Object.entries(row)).toEqual([["cruise", "c1"], ["profileid", "s1c1"], ["firstimage", "3907"]]);
    });

    test("names the missing row and the fix", () => {
        expect(() => parseUvp5HeaderRow(header, "s9")).toThrow(
            "the meta header has no row for profileid s9. Add it to meta/uvp5_header_sn*.txt, then relaunch the import or the pivot regeneration.");
    });
});
