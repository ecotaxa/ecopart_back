import { parquetMetadata, parquetReadObjects } from "hyparquet";

// A Parquet file read back whole, for assertions: its columns as the schema declares them, its
// rows as hyparquet decodes them (INT64 as bigint, timestamps as Date, null for a missing value).
export interface ParquetTable {
    columns: Array<{ name: string; type?: string; converted_type?: string; logical_type?: unknown; repetition_type?: string }>;
    rows: Record<string, unknown>[];
    num_rows: number;
    row_groups: number;
    codec?: string;
}

export async function readParquet(buffer: Buffer): Promise<ParquetTable> {
    const file = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const metadata = parquetMetadata(file);
    const rows = await parquetReadObjects({ file });
    return {
        columns: metadata.schema.slice(1).map((element) => ({
            name: element.name,
            type: element.type,
            converted_type: element.converted_type,
            logical_type: element.logical_type,
            repetition_type: element.repetition_type,
        })),
        rows,
        num_rows: Number(metadata.num_rows),
        row_groups: metadata.row_groups.length,
        codec: metadata.row_groups[0]?.columns[0]?.meta_data?.codec,
    };
}
