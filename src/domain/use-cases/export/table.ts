import { ExportTableFormat } from "../../entities/export";
import { TsvTableWriter } from "./tsv";
import { ParquetTableWriter } from "./parquet";

// The tables EcoPart generates in an export (`metadata/projects`, `metadata/samples`, the binned
// `particles`) are described once, as typed columns, and written in the format the request asks
// for. The files copied as imported are not tables and are not concerned.

export type TableColumnType = "string" | "integer" | "double" | "boolean" | "timestamp";

export interface TableColumn {
    name: string;
    type: TableColumnType;
}

// A cell. `null` is the absence of a value. A string in a column of another type (the `NA` token
// of the binned export) is written as such in a TSV; it has no typed form, so Parquet holds null.
export type TableValue = string | number | boolean | Date | null;

export interface TableWriterOptions {
    // TSV only: how a number is written (`String` by default). Parquet stores the number itself.
    formatNumber?: (value: number) => string;
}

// Rows are appended in batches, so a long table never has to sit whole in memory.
export interface TableWriter {
    readonly file_path: string;
    append(rows: TableValue[][]): Promise<void>;
    close(): Promise<void>;
}

export function tableFileName(base_name: string, format: ExportTableFormat): string {
    return `${base_name}.${format}`;
}

export async function openTableWriter(format: ExportTableFormat, path_without_extension: string, columns: TableColumn[], options: TableWriterOptions = {}): Promise<TableWriter> {
    const file_path = tableFileName(path_without_extension, format);
    return format === "parquet"
        ? ParquetTableWriter.open(file_path, columns)
        : TsvTableWriter.open(file_path, columns, options);
}

export async function writeTable(format: ExportTableFormat, path_without_extension: string, columns: TableColumn[], rows: TableValue[][], options: TableWriterOptions = {}): Promise<void> {
    const writer = await openTableWriter(format, path_without_extension, columns, options);
    await writer.append(rows);
    await writer.close();
}

// A date as stored: a Date when it parses, else the text as stored, so that nothing is lost.
export function dateValue(date_string: string | null | undefined): Date | string | null {
    if (date_string === null || date_string === undefined || date_string === "") return null;
    const date = new Date(date_string);
    return Number.isNaN(date.getTime()) ? date_string : date;
}
