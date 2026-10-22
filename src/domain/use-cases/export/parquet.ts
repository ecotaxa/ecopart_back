import * as fsPromises from "fs/promises";
import { ByteWriter, ParquetWriter } from "hyparquet-writer";

import type { TableColumn, TableValue, TableWriter } from "./table";

// Apache Parquet form of an export table, written with hyparquet-writer: Snappy compression (the
// codec every reader supports), one nullable column per table column, typed as `schemaElement`.

type ParquetSchema = ConstructorParameters<typeof ParquetWriter>[0]["schema"];
type ParquetColumnData = Parameters<ParquetWriter["write"]>[0]["columnData"];

// Rows are gathered into row groups of this many rows: large enough for an efficient file, small
// enough that a long table never sits whole in memory.
const ROW_GROUP_ROWS = 20_000;

function schemaElement(column: TableColumn): ParquetSchema[number] {
    const name = column.name;
    switch (column.type) {
        case "string":
            return { name, type: "BYTE_ARRAY", converted_type: "UTF8", logical_type: { type: "STRING" }, repetition_type: "OPTIONAL" };
        case "integer":
            return { name, type: "INT64", repetition_type: "OPTIONAL" };
        case "double":
            return { name, type: "DOUBLE", repetition_type: "OPTIONAL" };
        case "boolean":
            return { name, type: "BOOLEAN", repetition_type: "OPTIONAL" };
        case "timestamp":
            return { name, type: "INT64", converted_type: "TIMESTAMP_MILLIS", logical_type: { type: "TIMESTAMP", isAdjustedToUTC: true, unit: "MILLIS" }, repetition_type: "OPTIONAL" };
    }
}

export function parquetSchema(columns: TableColumn[]): ParquetSchema {
    return [{ name: "root", num_children: columns.length }, ...columns.map(schemaElement)];
}

// The typed form of a cell, null when the value has none in the column's type: a string where a
// number is expected (the `NA` token of the binned export), a date that does not parse.
export function parquetValue(column: TableColumn, value: TableValue | undefined): string | bigint | number | boolean | Date | null {
    if (value === null || value === undefined) return null;
    switch (column.type) {
        case "string":
            return value instanceof Date ? value.toISOString() : String(value);
        case "integer":
            if (typeof value !== "number" || !Number.isFinite(value)) return null;
            if (!Number.isInteger(value)) throw new Error(`Column ${column.name} holds a non-integer value: ${value}`);
            return BigInt(value);
        case "double":
            return typeof value === "number" ? value : null;
        case "boolean":
            return typeof value === "boolean" ? value : null;
        case "timestamp": {
            const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
            return date === null || Number.isNaN(date.getTime()) ? null : date;
        }
    }
}

// ByteWriter keeps the whole file in memory. This one hands the bytes of each row group to the
// file as soon as the group is complete: ParquetWriter calls flush() after every row group and
// awaits it. `offset` keeps counting from the start of the file, `index` restarts in the buffer.
class FileByteWriter extends ByteWriter {
    constructor(private readonly handle: fsPromises.FileHandle) {
        super();
    }

    async flush(): Promise<void> {
        if (this.index === 0) return;
        await this.handle.write(new Uint8Array(this.buffer, 0, this.index));
        this.index = 0;
    }

    async finish(): Promise<void> {
        await this.flush();
    }

    getBuffer(): ArrayBuffer {
        throw new Error("The parquet file is written to disk, not kept in memory");
    }

    getBytes(): Uint8Array {
        throw new Error("The parquet file is written to disk, not kept in memory");
    }
}

export class ParquetTableWriter implements TableWriter {
    private pending: TableValue[][] = [];
    private closed = false;

    private constructor(
        readonly file_path: string,
        private readonly columns: TableColumn[],
        private readonly handle: fsPromises.FileHandle,
        private readonly writer: ParquetWriter,
    ) { }

    static async open(file_path: string, columns: TableColumn[]): Promise<ParquetTableWriter> {
        const handle = await fsPromises.open(file_path, "w");
        try {
            const writer = new ParquetWriter({ writer: new FileByteWriter(handle), schema: parquetSchema(columns) });
            return new ParquetTableWriter(file_path, columns, handle, writer);
        } catch (error) {
            await handle.close().catch(() => undefined);
            throw error;
        }
    }

    async append(rows: TableValue[][]): Promise<void> {
        for (const row of rows) this.pending.push(row);
        while (this.pending.length >= ROW_GROUP_ROWS) {
            await this.writeRowGroup(this.pending.splice(0, ROW_GROUP_ROWS));
        }
    }

    // Writes the rows left and the footer, then releases the file. A second call does nothing, so
    // a failed export can call it without caring whether the first one got through.
    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        try {
            if (this.pending.length > 0) await this.writeRowGroup(this.pending.splice(0));
            await this.writer.finish();
        } finally {
            await this.handle.close();
        }
    }

    private async writeRowGroup(rows: TableValue[][]): Promise<void> {
        const columnData: ParquetColumnData = this.columns.map((column, i) => ({
            name: column.name,
            data: rows.map(row => parquetValue(column, row[i])),
        }));
        await this.writer.write({ columnData, rowGroupSize: rows.length });
    }
}
