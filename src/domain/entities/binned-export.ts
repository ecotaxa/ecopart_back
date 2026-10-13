import { PerImageRecord } from "./sample-qc-graph";

/* BINNED EXPORT (product 1, docs/export-products-and-uvp6-pivot.md)
 *
 * Computed on the fly from the UVP6-format pivot of each sample: the converted
 * `<sample>/pivot/<sample>_Particule.zip` of a UVP5 sample, the imported `_Particule.zip` of a UVP6.
 */

// One `area_px,nb_particles,grey_mean,grey_std` block of a particules.csv line.
export interface PivotParticleBlock {
    area_px: number;                 // exact pixel area of the particles of the block
    nb_particles: number;
    grey_mean: number | null;        // mean grey of their pixels, null when the file has none
}

// A pivot line, with the particle blocks the QC-graph record reduces to counts.
export interface PivotImageRecord extends PerImageRecord {
    blocks: PivotParticleBlock[];
}

// `auto` bins each sample along its own type: depth profiles by depth, time series by time.
export type BinnedExportBinMode = "auto" | "depth" | "time";
