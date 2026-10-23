import { CTD_PRESSURE_COLUMN, CTD_TIME_COLUMN, normalizeCtdColumn, parseCtdRows, parseCtdTime } from "../../../src/domain/utils/ctd-rows";

async function* linesOf(text: string): AsyncIterable<string> {
    for (const line of text.split("\n")) yield line;
}

describe("normalizeCtdColumn", () => {
    test("lower-cases, trims and collapses the spaces of a title", () => {
        expect(normalizeCtdColumn("  Pressure   [DB] ")).toBe(CTD_PRESSURE_COLUMN);
        expect(normalizeCtdColumn("Temperature [degC]")).toBe("temperature [degc]");
        expect(normalizeCtdColumn("Time [yyyymmddhhmmssmmm]")).toBe(CTD_TIME_COLUMN);
    });

    test("resolves the alternative spellings of the standard columns", () => {
        expect(normalizeCtdColumn("Pressure in water column [db]")).toBe("pressure [db]");
        expect(normalizeCtdColumn("Chloro fluo [mg Chl/m3]")).toBe("chloro fluo [mg chl m-3]");
        expect(normalizeCtdColumn("Depth [salt water, m]")).toBe("depth [m]");
        expect(normalizeCtdColumn("Oxygen [µmol/kg]")).toBe("oxygen [umol kg-1]");
    });

    test("keeps a custom column as written, lower-cased", () => {
        expect(normalizeCtdColumn("Turbidity NTU")).toBe("turbidity ntu");
    });
});

describe("parseCtdTime", () => {
    test("yyyymmddhhmmssmmm to epoch milliseconds, UTC", () => {
        expect(parseCtdTime("20240612102030123")).toBe(Date.UTC(2024, 5, 12, 10, 20, 30, 123));
    });

    test("the milliseconds may be missing; surrounding spaces are ignored", () => {
        expect(parseCtdTime("20240612102030")).toBe(Date.UTC(2024, 5, 12, 10, 20, 30, 0));
        expect(parseCtdTime(" 20240612102030 \r")).toBe(Date.UTC(2024, 5, 12, 10, 20, 30, 0));
    });

    test.each(["", "NaN", "2024061210203", "202406121020301", "2024-06-12T10:20:30", "20240612102030.123"])("%p is unreadable", (value) => {
        expect(parseCtdTime(value)).toBeNull();
    });

    test("an impossible date or time is unreadable", () => {
        expect(parseCtdTime("20241312102030")).toBeNull();
        expect(parseCtdTime("20240632102030")).toBeNull();
        expect(parseCtdTime("20240612252030")).toBeNull();
    });
});

describe("parseCtdRows", () => {
    const header = ["Pressure in water column [db]", "Temperature [degC]", "Chloro fluo [mg Chl/m3]", "QC flag", "Time [yyyymmddhhmmssmmm]"].join("\t");

    test("normalised columns, numbers per cell, null for NaN and empty cells, the time column parsed apart", async () => {
        const text = [
            header,
            ["1.5", "13.2", "NaN", "0", "20240612102030123"].join("\t"),
            ["2,5", "", "0.12", "0", "20240612102031000"].join("\t"),
            "",
            ["3.0", "13.0"].join("\t"),
            ["4.0", "12.9", "0.10", "1", "not a time", "extra", "cells"].join("\t"),
            ["5.0", "inf", "Infinity", "-", "20240612102033000\r"].join("\t"),
        ].join("\n");

        const rows = await parseCtdRows(linesOf(text));

        expect(rows.columns).toEqual(["pressure [db]", "temperature [degc]", "chloro fluo [mg chl m-3]", "qc flag", "time [yyyymmddhhmmssmmm]"]);
        expect(rows.values).toEqual([
            [1.5, 13.2, null, 0, null],
            [2.5, null, 0.12, 0, null],
            // A short row is padded with nulls, extra cells are dropped.
            [3, 13, null, null, null],
            [4, 12.9, 0.1, 1, null],
            [5, null, null, null, null],
        ]);
        expect(rows.time_ms).toEqual([
            Date.UTC(2024, 5, 12, 10, 20, 30, 123),
            Date.UTC(2024, 5, 12, 10, 20, 31, 0),
            null,
            null,
            Date.UTC(2024, 5, 12, 10, 20, 33, 0),
        ]);
    });

    test("a file without time column has null times", async () => {
        const rows = await parseCtdRows(linesOf("Pressure [db]\tTemperature [degC]\n1\t13\n2\t12.5"));

        expect(rows.values).toEqual([[1, 13], [2, 12.5]]);
        expect(rows.time_ms).toEqual([null, null]);
    });

    test("a header alone gives no row, an empty file no column", async () => {
        await expect(parseCtdRows(linesOf(header))).resolves.toEqual({ columns: ["pressure [db]", "temperature [degc]", "chloro fluo [mg chl m-3]", "qc flag", "time [yyyymmddhhmmssmmm]"], values: [], time_ms: [] });
        await expect(parseCtdRows(linesOf(""))).resolves.toEqual({ columns: [], values: [], time_ms: [] });
    });
});
