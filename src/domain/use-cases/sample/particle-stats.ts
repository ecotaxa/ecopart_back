import { SampleParticleStats } from "../../entities/sample";
import { IMAGE_FLAG_LIGHT_ON, IMAGE_FLAG_OVER_EXPOSED, PerImageColumns } from "../../entities/sample-qc-graph";
import { PivotImages } from "../../interfaces/repositories/sample-repository";
import { hasImageFlag, imageIdAt } from "../../utils/per-image-columns";
import { BinnedSampleSettings, minimumAreaPx } from "../export/binned-computation";
import { selectUsedImages } from "./qc-graphs-builder";

// Whatever the instrument, the pivot is a UVP6-format file: pressures already in decibar.
const PIVOT_FORMAT = "UVP6";

// The statistics fields of a sample whose particle file could not be read.
export const NO_PARTICLE_STATS = {
    nb_particles: null,
    particle_min_area_px: null,
    particle_max_area_px: null,
    nb_particles_descent_filter: null,
    particle_min_area_px_descent_filter: null,
    particle_max_area_px_descent_filter: null,
};

class ParticleTally {
    nb_particles = 0;
    min_area_px: number | null = null;
    max_area_px: number | null = null;

    add(area_px: number, nb_particles: number): void {
        this.nb_particles += nb_particles;
        if (this.min_area_px === null || area_px < this.min_area_px) this.min_area_px = area_px;
        if (this.max_area_px === null || area_px > this.max_area_px) this.max_area_px = area_px;
    }
}

/* Particle statistics of a sample, from its pivot in two passes (see PivotImages): the particles of
 * the lit, not over-exposed images whose area reaches the minimum area the instrument kept, over the
 * images of the operator window, then over those the descent filter keeps too (the selection of the
 * QC graphs and of the binned export when the project enables it). Both are computed whatever the
 * project's setting, which picks one when they are read. */
export async function computeParticleStats(settings: BinnedSampleSettings, pivot: PivotImages): Promise<SampleParticleStats> {
    const columns = pivot.columns;
    const in_window = selectImages(settings, columns, false);
    const kept_by_descent_filter = selectImages(settings, columns, true);
    const minimum_area_px = minimumAreaPx(settings.particle_minimum_area_px);
    const changedWhileRead = () => new Error(`The particle file of sample ${settings.sample_name} changed while it was read. Compute its particle statistics again.`);

    const window_tally = new ParticleTally();
    const descent_tally = new ParticleTally();
    let k = 0;
    for await (const record of pivot.rows()) {
        if (k >= columns.length || record.image_id !== imageIdAt(columns, k)) throw changedWhileRead();
        const counted = in_window[k] === 1 && hasImageFlag(columns, k, IMAGE_FLAG_LIGHT_ON) && !hasImageFlag(columns, k, IMAGE_FLAG_OVER_EXPOSED);
        const descending = kept_by_descent_filter[k] === 1;
        k++;
        if (!counted) continue;
        for (const block of record.blocks) {
            if (block.area_px < minimum_area_px || block.nb_particles <= 0) continue;
            window_tally.add(block.area_px, block.nb_particles);
            if (descending) descent_tally.add(block.area_px, block.nb_particles);
        }
    }
    if (k !== columns.length) throw changedWhileRead();

    return {
        nb_particles: window_tally.nb_particles,
        particle_min_area_px: window_tally.min_area_px,
        particle_max_area_px: window_tally.max_area_px,
        nb_particles_descent_filter: descent_tally.nb_particles,
        particle_min_area_px_descent_filter: descent_tally.min_area_px,
        particle_max_area_px_descent_filter: descent_tally.max_area_px,
    };
}

// The images the sample uses, with or without the descent filter (which only ever applies to a depth
// profile). A UVP5 pivot was cut to the operator window at conversion, only a UVP6 file still has its
// window applied here (as in BinnedSampleBuilder).
function selectImages(settings: BinnedSampleSettings, columns: PerImageColumns, descent_filter_enabled: boolean): Uint8Array {
    const window_cut_at_conversion = settings.instrument_model.startsWith("UVP5");
    return selectUsedImages({
        sample_id: null,
        sample_name: settings.sample_name,
        instrument_model: PIVOT_FORMAT,
        visual_qc_status_label: "",
        filter_first_image: window_cut_at_conversion ? null : settings.filter_first_image,
        filter_last_image: window_cut_at_conversion ? null : settings.filter_last_image,
        instrument_settings_depth_offset_m: settings.depth_offset_m,
        instrument_settings_image_volume_l: settings.image_volume_l,
        is_depth_profile: settings.is_depth_profile,
        descent_filter_enabled,
        records: columns,
    });
}

// One line for the task logs.
export function describeParticleStats(sample_name: string, stats: SampleParticleStats): string {
    if (stats.nb_particles === 0) return `${sample_name}: no particle counted`;
    const counted = `${sample_name}: ${stats.nb_particles} particle(s) counted, areas from ${stats.particle_min_area_px} to ${stats.particle_max_area_px} px`;
    if (stats.nb_particles_descent_filter === stats.nb_particles) return counted;
    return `${counted}, ${stats.nb_particles_descent_filter} kept by the descent filter`;
}
