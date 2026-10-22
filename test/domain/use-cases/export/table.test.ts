import fs from "fs";
import os from "os";
import path from "path";

import { dateValue, openTableWriter, TableColumn, writeTable } from "../../../../src/domain/use-cases/export/table";
import { parquetValue } from "../../../../src/domain/use-cases/export/parquet";
import { serialize, tsvSanitize } from "../../../../src/domain/use-cases/export/tsv";
import { readParquet } from "../../../helpers/parquet";

const COLUMNS: TableColumn[] = [
    { name: "id", type: "integer" },
    { name: "value", type: "double" },
    { name: "flag", type: "boolean" },
    { name: "when", type: "timestamp" },
    { name: "label", type: "string" },
];
const WHEN = new Date(Date.UTC(2020, 7, 6, 22, 0, 0));
// A full row, a row with the binned export's `NA` token and an unreadable date, a row of nulls.
const ROWS = [
    [1, 0.5, true, WHEN, "a\tb\nc"],
    [2, "NA", false, "not a date", null],
    [null, null, null, null, "NA"],
];

describe("export tables", () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-table-"));
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    describe("TSV", () => {
        test("one header row, tab-separated cells, booleans as text, ISO timestamps, empty cell for null, NA as such", async () => {
            await writeTable("tsv", path.join(dir, "t"), COLUMNS, ROWS);

            expect(fs.readFileSync(path.join(dir, "t.tsv"), "utf8")).toBe([
                "id\tvalue\tflag\twhen\tlabel",
                "1\t0.5\ttrue\t2020-08-06T22:00:00.000Z\ta b c",
                "2\tNA\tfalse\tnot a date\t",
                "\t\t\t\tNA",
                "",
            ].join("\n"));
        });

        test("numbers are written as given, or through the formatter the table asks for", async () => {
            await writeTable("tsv", path.join(dir, "raw"), [{ name: "x", type: "double" }], [[0.1 + 0.2]]);
            await writeTable("tsv", path.join(dir, "fmt"), [{ name: "x", type: "double" }], [[0.1 + 0.2]], { formatNumber: (n) => n.toFixed(2) });

            expect(fs.readFileSync(path.join(dir, "raw.tsv"), "utf8")).toBe("x\n0.30000000000000004\n");
            expect(fs.readFileSync(path.join(dir, "fmt.tsv"), "utf8")).toBe("x\n0.30\n");
        });

        test("rows appended in several batches make one table", async () => {
            const writer = await openTableWriter("tsv", path.join(dir, "t"), [{ name: "x", type: "integer" }]);
            await writer.append([[1], [2]]);
            await writer.append([]);
            await writer.append([[3]]);
            await writer.close();

            expect(writer.file_path).toBe(path.join(dir, "t.tsv"));
            expect(fs.readFileSync(writer.file_path, "utf8")).toBe("x\n1\n2\n3\n");
        });

        test("cells: no value is empty, an invalid date too, tabs and line breaks collapse to one space", () => {
            expect(serialize(null)).toBe("");
            expect(serialize(undefined)).toBe("");
            expect(serialize(false)).toBe("false");
            expect(serialize(new Date(NaN))).toBe("");
            expect(serialize(1 / 3, (n) => n.toFixed(3))).toBe("0.333");
            expect(tsvSanitize("a\t\tb\r\nc")).toBe("a b c");
        });
    });

    describe("Parquet", () => {
        test("typed nullable columns under Snappy; NA and an unreadable date are null; text keeps its tabs and line breaks", async () => {
            await writeTable("parquet", path.join(dir, "t"), COLUMNS, ROWS);

            const table = await readParquet(fs.readFileSync(path.join(dir, "t.parquet")));
            expect(table.codec).toBe("SNAPPY");
            expect(table.columns).toEqual([
                { name: "id", type: "INT64", converted_type: undefined, logical_type: undefined, repetition_type: "OPTIONAL" },
                { name: "value", type: "DOUBLE", converted_type: undefined, logical_type: undefined, repetition_type: "OPTIONAL" },
                { name: "flag", type: "BOOLEAN", converted_type: undefined, logical_type: undefined, repetition_type: "OPTIONAL" },
                { name: "when", type: "INT64", converted_type: "TIMESTAMP_MILLIS", logical_type: { type: "TIMESTAMP", isAdjustedToUTC: true, unit: "MILLIS" }, repetition_type: "OPTIONAL" },
                { name: "label", type: "BYTE_ARRAY", converted_type: "UTF8", logical_type: { type: "STRING" }, repetition_type: "OPTIONAL" },
            ]);
            expect(table.rows).toEqual([
                { id: BigInt(1), value: 0.5, flag: true, when: WHEN, label: "a\tb\nc" },
                { id: BigInt(2), value: null, flag: false, when: null, label: null },
                { id: null, value: null, flag: null, when: null, label: "NA" },
            ]);
        });

        test("a table without any row is a valid file that still declares its columns", async () => {
            await writeTable("parquet", path.join(dir, "empty"), COLUMNS, []);

            const table = await readParquet(fs.readFileSync(path.join(dir, "empty.parquet")));
            expect(table.num_rows).toBe(0);
            expect(table.rows).toEqual([]);
            expect(table.columns.map((c) => c.name)).toEqual(COLUMNS.map((c) => c.name));
        });

        test("rows appended in batches are gathered into row groups of 20 000, whatever the batches", async () => {
            const writer = await openTableWriter("parquet", path.join(dir, "big"), [{ name: "id", type: "integer" }, { name: "label", type: "string" }]);
            for (let batch = 0; batch < 45; batch++) {
                await writer.append(Array.from({ length: 1000 }, (_, i) => [batch * 1000 + i, `row ${i % 10}`]));
            }
            await writer.close();

            const table = await readParquet(fs.readFileSync(path.join(dir, "big.parquet")));
            expect(table.num_rows).toBe(45_000);
            expect(table.row_groups).toBe(3);
            expect(table.rows[0]).toEqual({ id: BigInt(0), label: "row 0" });
            expect(table.rows[44_999]).toEqual({ id: BigInt(44_999), label: "row 9" });
        });

        test("closing twice is harmless, and the file handle is released on close", async () => {
            const writer = await openTableWriter("parquet", path.join(dir, "twice"), COLUMNS);
            await writer.append([ROWS[0]]);
            await writer.close();
            await expect(writer.close()).resolves.toBeUndefined();

            expect((await readParquet(fs.readFileSync(path.join(dir, "twice.parquet")))).num_rows).toBe(1);
        });

        test("typed cells: a whole number becomes a 64-bit integer, a fraction in an integer column is refused, NaN is null", () => {
            const integer: TableColumn = { name: "n", type: "integer" };
            expect(parquetValue(integer, 7)).toBe(BigInt(7));
            expect(parquetValue(integer, NaN)).toBeNull();
            expect(parquetValue(integer, "NA")).toBeNull();
            expect(() => parquetValue(integer, 7.5)).toThrow("Column n holds a non-integer value: 7.5");
            expect(parquetValue({ name: "d", type: "double" }, "NA")).toBeNull();
            expect(parquetValue({ name: "b", type: "boolean" }, "true")).toBeNull();
            expect(parquetValue({ name: "t", type: "timestamp" }, "2020-08-06T22:00:00.000Z")).toEqual(WHEN);
            expect(parquetValue({ name: "t", type: "timestamp" }, "20200313004656")).toBeNull();
            expect(parquetValue({ name: "s", type: "string" }, WHEN)).toBe("2020-08-06T22:00:00.000Z");
            expect(parquetValue({ name: "s", type: "string" }, 12)).toBe("12");
        });
    });

    test("dateValue: a readable date becomes a Date, unreadable text is kept, nothing becomes null", () => {
        expect(dateValue("2024-11-20T16:35:31.000Z")).toEqual(new Date("2024-11-20T16:35:31.000Z"));
        expect(dateValue("20200313004656")).toBe("20200313004656");
        expect(dateValue("")).toBeNull();
        expect(dateValue(null)).toBeNull();
        expect(dateValue(undefined)).toBeNull();
    });
});
