import { SampleParticleStats } from "../../entities/sample";
import { IMAGE_FLAG_LIGHT_ON, IMAGE_FLAG_OVER_EXPOSED } from "../../entities/sample-qc-graph";
import { PivotImages } from "../../interfaces/repositories/sample-repository";
import { hasImageFlag, imageIdAt } from "../../utils/per-image-columns";
import { BinnedSampleSettings, minimumAreaPx } from "../export/binned-computation";
import { selectUsedImages } from "./qc-graphs-builder";

// Whatever the instrument, the pivot is a UVP6-format file: pressures already in decibar.
const PIVOT_FORMAT = "UVP6";

/* Particle statistics of a sample, from its pivot in two passes (see PivotImages): the particles
 * counted by the binned export, that is those of the images the sample uses (operator window,
 * descent filter: the selection of the QC graphs), lit and not over-exposed, whose area reaches the
 * minimum area the instrument kept. */
export async function computeParticleStats(settings: BinnedSampleSettings, pivot: PivotImages): Promise<SampleParticleStats> {
    const columns = pivot.columns;
    // A UVP5 pivot was cut to the operator window at conversion, only a UVP6 file still has its
    // window applied here (as in BinnedSampleBuilder).
    const window_cut_at_conversion = settings.instrument_model.startsWith("UVP5");
    const selected = selectUsedImages({
        sample_id: null,
        sample_name: settings.sample_name,
        instrument_model: PIVOT_FORMAT,
        visual_qc_status_label: "",
        filter_first_image: window_cut_at_conversion ? null : settings.filter_first_image,
        filter_last_image: window_cut_at_conversion ? null : settings.filter_last_image,
        instrument_settings_depth_offset_m: settings.depth_offset_m,
        instrument_settings_image_volume_l: settings.image_volume_l,
        is_depth_profile: settings.is_depth_profile,
        descent_filter_enabled: settings.descent_filter_enabled,
        records: columns,
    });
    const minimum_area_px = minimumAreaPx(settings.particle_minimum_area_px);
    const changedWhileRead = () => new Error(`The particle file of sample ${settings.sample_name} changed while it was read. Compute its particle statistics again.`);

    let nb_particles = 0;
    let min_area_px: number | null = null;
    let max_area_px: number | null = null;
    let k = 0;
    for await (const record of pivot.rows()) {
        if (k >= columns.length || record.image_id !== imageIdAt(columns, k)) throw changedWhileRead();
        const counted = selected[k] === 1 && hasImageFlag(columns, k, IMAGE_FLAG_LIGHT_ON) && !hasImageFlag(columns, k, IMAGE_FLAG_OVER_EXPOSED);
        k++;
        if (!counted) continue;
        for (const block of record.blocks) {
            if (block.area_px < minimum_area_px || block.nb_particles <= 0) continue;
            nb_particles += block.nb_particles;
            if (min_area_px === null || block.area_px < min_area_px) min_area_px = block.area_px;
            if (max_area_px === null || block.area_px > max_area_px) max_area_px = block.area_px;
        }
    }
    if (k !== columns.length) throw changedWhileRead();

    return { nb_particles, particle_min_area_px: min_area_px, particle_max_area_px: max_area_px };
}

// One line for the task logs.
export function describeParticleStats(sample_name: string, stats: SampleParticleStats): string {
    if (stats.nb_particles === 0) return `${sample_name}: no particle counted`;
    return `${sample_name}: ${stats.nb_particles} particle(s) counted, areas from ${stats.particle_min_area_px} to ${stats.particle_max_area_px} px`;
}
