import { ECOTAXA_BIOTA_TAXO_ID } from "../../constants/ecotaxa-living-taxo";
import { EcoTaxaTaxon } from "../../entities/ecotaxa_account";
import { EcoTaxaHistogramBin, ExploreSampleRow, GraphDataset, ProfileSeries } from "../../entities/explore";
import { roundPosition, roundValue } from "./explore-graphs";

/* The concentrations per EcoTaxa category of the Explore page, as legacy EcoPart drew them
 * (`drawchart.py`, taxonomy graphs): the objects of a sample are counted per 5 m depth bin
 * (`GenerateTaxonomyHistogram`, depth_min + depth offset), the counts and the imaged water volume
 * of the particle bins are summed over wider depth bins, and the concentration is 1000 × objects /
 * litres, in # m-3. Depth profiles only. */

// Depth step of the stored histograms (legacy part_histocat). It divides every ECOTAXA_DEPTH_LIMITS.
export const ECOTAXA_HISTOGRAM_STEP_M = 5;

// Legacy DepthTaxoHistoLimit: the objects are too few per 5 m for a readable curve, so the bins
// widen with depth. Metres, each bin from one limit (included) to the next (excluded).
export const ECOTAXA_DEPTH_LIMITS: readonly number[] = [
    0, 25, 50, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000,
    1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500, 4750, 5000,
    5250, 5500, 5750, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 20000, 50000,
];

// The bin of ECOTAXA_DEPTH_LIMITS holding `depth`, -1 outside them.
export function depthLimitIndex(depth: number): number {
    if (!(depth >= 0)) return -1;
    for (let i = 0; i < ECOTAXA_DEPTH_LIMITS.length - 1; i++) {
        if (depth < ECOTAXA_DEPTH_LIMITS[i + 1]) return i;
    }
    return -1;
}

export interface EcoTaxaGraphSample {
    sample: ExploreSampleRow;
    bins: EcoTaxaHistogramBin[];
    // The particle bins of ECOTAXA_HISTOGRAM_STEP_M: centre depth (m, offset included) and imaged volume (litres).
    volumes: { positions: number[]; volumes: number[] };
    // The EcoTaxa category of an id, on the instance of the sample.
    taxonOf: (classif_id: number) => EcoTaxaTaxon | undefined;
}

export interface EcoTaxaGraphOptions {
    include_predicted: boolean;
    sum_child_taxa: boolean;
    exclude_not_living: boolean;
}

const HALF_STEP = ECOTAXA_HISTOGRAM_STEP_M / 2;

interface WideBin {
    volume_l: number;
    top: number;                              // shallowest depth with volume in the bin
    bottom: number;                           // deepest
}

// The imaged volume of each wide bin, with the depths it covers.
function wideBinsOf(volumes: EcoTaxaGraphSample["volumes"]): Map<number, WideBin> {
    const wide = new Map<number, WideBin>();
    for (let i = 0; i < volumes.positions.length; i++) {
        const volume = volumes.volumes[i];
        if (!(volume > 0)) continue;
        const index = depthLimitIndex(volumes.positions[i]);
        if (index < 0) continue;
        const bin = wide.get(index) ?? { volume_l: 0, top: Infinity, bottom: -Infinity };
        bin.volume_l += volume;
        bin.top = Math.min(bin.top, volumes.positions[i] - HALF_STEP);
        bin.bottom = Math.max(bin.bottom, volumes.positions[i] + HALF_STEP);
        wide.set(index, bin);
    }
    return wide;
}

const countOf = (bin: EcoTaxaHistogramBin, include_predicted: boolean) => bin.nb_validated + (include_predicted ? bin.nb_predicted : 0);

// The curves of every category the drawn samples have objects of, the most abundant first. With
// `sum_child_taxa`, a category also counts the objects of the categories below it among those.
export function buildEcoTaxaDataset(samples: EcoTaxaGraphSample[], options: EcoTaxaGraphOptions): GraphDataset {
    const keep = (taxon: EcoTaxaTaxon | undefined): taxon is EcoTaxaTaxon =>
        taxon !== undefined && (!options.exclude_not_living || taxon.id_lineage.includes(ECOTAXA_BIOTA_TAXO_ID));

    // The categories offered: those with objects counted in the selection.
    const used = new Set<string>();
    for (const { bins, taxonOf } of samples) {
        for (const bin of bins) {
            const taxon = taxonOf(bin.classif_id);
            if (countOf(bin, options.include_predicted) > 0 && keep(taxon)) used.add(taxon.display_name);
        }
    }

    const totals = new Map<string, number>();
    const series = new Map<string, ProfileSeries[]>();
    for (const { sample, bins, volumes, taxonOf } of samples) {
        const wide = wideBinsOf(volumes);
        if (wide.size === 0) continue;
        // Objects per category and wide bin; the objects of a bin without volume are not drawn.
        const counts = new Map<string, Map<number, number>>();
        for (const bin of bins) {
            const count = countOf(bin, options.include_predicted);
            const taxon = taxonOf(bin.classif_id);
            if (count === 0 || !keep(taxon)) continue;
            const index = depthLimitIndex(bin.depth_bin * ECOTAXA_HISTOGRAM_STEP_M + HALF_STEP);
            if (!wide.has(index)) continue;
            const targets = new Set<string>([taxon.display_name]);
            if (options.sum_child_taxa) {
                for (const id of taxon.id_lineage) {
                    const ancestor = taxonOf(id);
                    if (ancestor && used.has(ancestor.display_name)) targets.add(ancestor.display_name);
                }
            }
            for (const name of targets) {
                const by_bin = counts.get(name) ?? new Map<number, number>();
                by_bin.set(index, (by_bin.get(index) ?? 0) + count);
                counts.set(name, by_bin);
            }
        }
        const indexes = Array.from(wide.keys()).sort((a, b) => a - b);
        for (const [name, by_bin] of counts) {
            const positions: number[] = [];
            const values: number[] = [];
            for (const index of indexes) {
                const bin = wide.get(index) as WideBin;
                // A step curve: each value held from the top of its bin down to the next point.
                positions.push(roundPosition(Math.max(ECOTAXA_DEPTH_LIMITS[index], bin.top)));
                values.push(roundValue(1000 * (by_bin.get(index) ?? 0) / bin.volume_l));
            }
            // The last value held down to the deepest depth its bin covers.
            const last = wide.get(indexes[indexes.length - 1]) as WideBin;
            positions.push(roundPosition(Math.min(ECOTAXA_DEPTH_LIMITS[indexes[indexes.length - 1] + 1], last.bottom)));
            values.push(values[values.length - 1]);
            const list = series.get(name) ?? [];
            list.push({ sample_id: sample.sample_id, sample_name: sample.sample_name, positions, values });
            series.set(name, list);
            totals.set(name, (totals.get(name) ?? 0) + Array.from(by_bin.values()).reduce((sum, n) => sum + n, 0));
        }
    }

    const keys = Array.from(series.keys()).sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b));
    const dataset: GraphDataset = { keys, axis_labels: {}, series: {} };
    for (const key of keys) {
        dataset.axis_labels[key] = `${key}${options.sum_child_taxa ? " and children" : ""} # m-3`;
        dataset.series[key] = series.get(key) as ProfileSeries[];
    }
    return dataset;
}
