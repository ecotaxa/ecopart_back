import { IMAGE_FLAG_EMPTY_IMAGE, IMAGE_FLAG_LIGHT_ON, IMAGE_FLAG_OVER_EXPOSED, PerImageColumns, PerImageRecord } from "../../src/domain/entities/sample-qc-graph";
import { hasImageFlag, imageIdAt, imageTimeAt, rawPressureAt } from "../../src/domain/utils/per-image-columns";

// The records held by the columns, back as one object per image. Only the classes the columns keep
// (1, 2 and 3 pixels) are in spectrum_counts, the zero counts left out.
export function recordsOf(columns: PerImageColumns): PerImageRecord[] {
    return Array.from({ length: columns.length }, (_, k) => {
        const spectrum_counts: Record<number, number> = {};
        columns.pixel_counts.forEach((counts, i) => { if (counts[k] !== 0) spectrum_counts[i + 1] = counts[k]; });
        const record: PerImageRecord = {
            image_index: columns.image_index[k],
            image_id: imageIdAt(columns, k),
            raw_pressure: rawPressureAt(columns, k),
            image_time_ms: imageTimeAt(columns, k),
            light_on: hasImageFlag(columns, k, IMAGE_FLAG_LIGHT_ON),
            spectrum_counts,
        };
        if (hasImageFlag(columns, k, IMAGE_FLAG_OVER_EXPOSED)) record.particle_data_flag = "OVER_EXPOSED";
        if (hasImageFlag(columns, k, IMAGE_FLAG_EMPTY_IMAGE)) record.particle_data_flag = "EMPTY_IMAGE";
        return record;
    });
}
