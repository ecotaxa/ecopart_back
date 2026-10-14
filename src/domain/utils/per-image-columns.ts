import {
    IMAGE_FLAG_EMPTY_IMAGE,
    IMAGE_FLAG_LIGHT_ON,
    IMAGE_FLAG_OVER_EXPOSED,
    PerImageColumns,
    PerImageRecord,
} from "../entities/sample-qc-graph";

// Beyond this, a sample is refused rather than risking the server's memory (~1.7 GB of columns).
export const MAX_PER_IMAGE_RECORDS = 30_000_000;
export const TOO_MANY_IMAGES_ERROR = "Sample has too many images to be read at once";

const INITIAL_CAPACITY = 1024;

// Appends records to growing columns. The columns grow by half each time they are full, and build()
// hands them over without copying: what is left unused stays at most a third of them.
export class PerImageColumnsBuilder {
    private length = 0;
    private capacity = INITIAL_CAPACITY;
    private image_index = new Int32Array(INITIAL_CAPACITY);
    private raw_pressure = new Float64Array(INITIAL_CAPACITY);
    private image_time_ms = new Float64Array(INITIAL_CAPACITY);
    private flags = new Uint8Array(INITIAL_CAPACITY);
    private pixel_counts: [Int32Array, Int32Array, Int32Array] = [new Int32Array(INITIAL_CAPACITY), new Int32Array(INITIAL_CAPACITY), new Int32Array(INITIAL_CAPACITY)];
    private image_id_ends = new Int32Array(INITIAL_CAPACITY);
    private image_ids = Buffer.allocUnsafe(INITIAL_CAPACITY * 20);
    private image_ids_length = 0;

    constructor(private readonly max_records: number = MAX_PER_IMAGE_RECORDS) { }

    push(record: PerImageRecord): void {
        const flags = (record.light_on ? IMAGE_FLAG_LIGHT_ON : 0)
            | (record.particle_data_flag === "OVER_EXPOSED" ? IMAGE_FLAG_OVER_EXPOSED : 0)
            | (record.particle_data_flag === "EMPTY_IMAGE" ? IMAGE_FLAG_EMPTY_IMAGE : 0);
        const counts = record.spectrum_counts;
        this.pushValues(record.image_index, record.image_id, record.raw_pressure ?? NaN, record.image_time_ms ?? NaN, flags, counts[1] ?? 0, counts[2] ?? 0, counts[3] ?? 0);
    }

    // The same, field by field (NaN for an unreadable pressure or time), for the readers that parse
    // millions of rows and build no record.
    pushValues(image_index: number, image_id: string, raw_pressure: number, image_time_ms: number, flags: number, count_1px: number, count_2px: number, count_3px: number): void {
        if (this.length >= this.max_records) {
            throw new Error(TOO_MANY_IMAGES_ERROR);
        }
        if (this.length === this.capacity) this.grow();
        const k = this.length++;
        this.image_index[k] = image_index;
        this.raw_pressure[k] = raw_pressure;
        this.image_time_ms[k] = image_time_ms;
        this.flags[k] = flags;
        this.pixel_counts[0][k] = count_1px;
        this.pixel_counts[1][k] = count_2px;
        this.pixel_counts[2][k] = count_3px;
        const id_length = Buffer.byteLength(image_id, "latin1");
        if (this.image_ids_length + id_length > this.image_ids.length) {
            this.image_ids = copyInto(Buffer.allocUnsafe(Math.ceil(Math.max(this.image_ids.length * 1.5, this.image_ids_length + id_length))), this.image_ids, this.image_ids_length);
        }
        this.image_ids_length += this.image_ids.write(image_id, this.image_ids_length, "latin1");
        this.image_id_ends[k] = this.image_ids_length;
    }

    build(): PerImageColumns {
        const n = this.length;
        return {
            length: n,
            image_index: this.image_index.subarray(0, n),
            raw_pressure: this.raw_pressure.subarray(0, n),
            image_time_ms: this.image_time_ms.subarray(0, n),
            flags: this.flags.subarray(0, n),
            pixel_counts: [this.pixel_counts[0].subarray(0, n), this.pixel_counts[1].subarray(0, n), this.pixel_counts[2].subarray(0, n)],
            image_ids: this.image_ids.subarray(0, this.image_ids_length),
            image_id_ends: this.image_id_ends.subarray(0, n),
        };
    }

    private grow(): void {
        const capacity = Math.ceil(this.capacity * 1.5);
        this.image_index = copyInto(new Int32Array(capacity), this.image_index, this.length);
        this.raw_pressure = copyInto(new Float64Array(capacity), this.raw_pressure, this.length);
        this.image_time_ms = copyInto(new Float64Array(capacity), this.image_time_ms, this.length);
        this.flags = copyInto(new Uint8Array(capacity), this.flags, this.length);
        this.pixel_counts = [
            copyInto(new Int32Array(capacity), this.pixel_counts[0], this.length),
            copyInto(new Int32Array(capacity), this.pixel_counts[1], this.length),
            copyInto(new Int32Array(capacity), this.pixel_counts[2], this.length),
        ];
        this.image_id_ends = copyInto(new Int32Array(capacity), this.image_id_ends, this.length);
        this.capacity = capacity;
    }
}

function copyInto<T extends Int32Array | Float64Array | Uint8Array>(target: T, source: T, length: number): T {
    target.set(source.subarray(0, length));
    return target;
}

export function toPerImageColumns(records: PerImageRecord[]): PerImageColumns {
    const builder = new PerImageColumnsBuilder();
    for (const record of records) builder.push(record);
    return builder.build();
}

export function imageIdAt(columns: PerImageColumns, k: number): string {
    return columns.image_ids.toString("latin1", k === 0 ? 0 : columns.image_id_ends[k - 1], columns.image_id_ends[k]);
}

// Pre-gain pressure read from the file, null when unreadable.
export function rawPressureAt(columns: PerImageColumns, k: number): number | null {
    const value = columns.raw_pressure[k];
    return Number.isNaN(value) ? null : value;
}

export function imageTimeAt(columns: PerImageColumns, k: number): number | null {
    const value = columns.image_time_ms[k];
    return Number.isNaN(value) ? null : value;
}

export function hasImageFlag(columns: PerImageColumns, k: number, flag: number): boolean {
    return (columns.flags[k] & flag) !== 0;
}
