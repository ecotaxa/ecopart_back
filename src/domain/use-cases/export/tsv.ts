import * as fsPromises from "fs/promises";

import type { TableColumn, TableValue, TableWriter, TableWriterOptions } from "./table";

// TSV conventions shared by the export products: UTF-8, tab-separated, one header row, no quoting.

// Replace tab/CR/LF in a TSV cell with a single space so the row stays parseable; no quoting.
export function tsvSanitize(value: string): string {
    return value.replace(/[\t\r\n]+/g, " ");
}

// Empty cell for no value, `true` / `false`, ISO 8601 UTC timestamps, numbers as formatted.
export function serialize(value: TableValue | undefined, formatNumber: (value: number) => string = String): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
    if (typeof value === "number") return formatNumber(value);
    return tsvSanitize(value);
}

export class TsvTableWriter implements TableWriter {
    private constructor(readonly file_path: string, private readonly formatNumber: (value: number) => string) { }

    static async open(file_path: string, columns: TableColumn[], options: TableWriterOptions = {}): Promise<TsvTableWriter> {
        await fsPromises.writeFile(file_path, columns.map(column => column.name).join("\t") + "\n");
        return new TsvTableWriter(file_path, options.formatNumber ?? String);
    }

    async append(rows: TableValue[][]): Promise<void> {
        if (rows.length === 0) return;
        const lines = rows.map(row => row.map(cell => serialize(cell, this.formatNumber)).join("\t"));
        await fsPromises.appendFile(this.file_path, lines.join("\n") + "\n");
    }

    async close(): Promise<void> {
        // Nothing to finish: every row is on disk once appended.
    }
}
