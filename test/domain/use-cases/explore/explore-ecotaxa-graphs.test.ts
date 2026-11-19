import { EcoTaxaTaxon } from "../../../../src/domain/entities/ecotaxa_account";
import { EcoTaxaHistogramBin } from "../../../../src/domain/entities/explore";
import {
    buildEcoTaxaDataset,
    depthLimitIndex,
    ECOTAXA_DEPTH_LIMITS,
    ECOTAXA_HISTOGRAM_STEP_M,
    EcoTaxaGraphOptions,
    EcoTaxaGraphSample,
} from "../../../../src/domain/use-cases/explore/explore-ecotaxa-graphs";
import { exploreSample } from "./explore-fixtures";

const TAXA: Record<number, EcoTaxaTaxon> = {
    10: { id: 10, name: "Copepoda", display_name: "Copepoda", id_lineage: [10, 85, 1], nb_objects: 0 },
    11: { id: 11, name: "Calanoida", display_name: "Calanoida", id_lineage: [11, 10, 85, 1], nb_objects: 0 },
    20: { id: 20, name: "detritus", display_name: "detritus", id_lineage: [20, 84963], nb_objects: 0 },
    30: { id: 30, name: "Appendicularia", display_name: "Appendicularia", id_lineage: [30, 92, 1], nb_objects: 0 },
};

const bin = (classif_id: number, depth_bin: number, nb_validated: number, nb_predicted = 0): EcoTaxaHistogramBin => ({ classif_id, depth_bin, nb_validated, nb_predicted });

// 5 m particle bins of 1 litre each, centred between `from` and `to` (metres).
function volumes(from: number, to: number, litres = 1): EcoTaxaGraphSample["volumes"] {
    const positions: number[] = [];
    for (let centre = from; centre <= to; centre += ECOTAXA_HISTOGRAM_STEP_M) positions.push(centre);
    return { positions, volumes: positions.map(() => litres) };
}

const graphSample = (sample_id: number, bins: EcoTaxaHistogramBin[], sample_volumes: EcoTaxaGraphSample["volumes"]): EcoTaxaGraphSample => ({
    sample: exploreSample({ sample_id, sample_name: `moose_${sample_id}` }),
    bins,
    volumes: sample_volumes,
    taxonOf: (classif_id) => TAXA[classif_id],
});

const OPTIONS: EcoTaxaGraphOptions = { include_predicted: false, sum_child_taxa: false, exclude_not_living: false };

// 0-50 m, 10 litres: 5 litres in each of the bins 0-25 and 25-50.
const PROFILE = graphSample(1, [
    bin(10, 0, 10),            // Copepoda, 0-5 m
    bin(11, 6, 5),             // Calanoida, 30-35 m
    bin(11, 1, 0, 4),          // Calanoida predicted, 5-10 m
    bin(20, 2, 3),             // detritus, 10-15 m
    bin(30, 8, 0, 2),          // Appendicularia predicted, 40-45 m
], volumes(2.5, 47.5));

describe("ECOTAXA_DEPTH_LIMITS", () => {
    test("every limit is a multiple of the histogram step, increasing from 0", () => {
        expect(ECOTAXA_DEPTH_LIMITS[0]).toBe(0);
        for (let i = 1; i < ECOTAXA_DEPTH_LIMITS.length; i++) {
            expect(ECOTAXA_DEPTH_LIMITS[i]).toBeGreaterThan(ECOTAXA_DEPTH_LIMITS[i - 1]);
            expect(ECOTAXA_DEPTH_LIMITS[i] % ECOTAXA_HISTOGRAM_STEP_M).toBe(0);
        }
    });

    test("depthLimitIndex: lower limit included, upper excluded, -1 outside", () => {
        expect(depthLimitIndex(0)).toBe(0);
        expect(depthLimitIndex(24.99)).toBe(0);
        expect(depthLimitIndex(25)).toBe(1);
        expect(depthLimitIndex(160)).toBe(6);
        expect(depthLimitIndex(1000)).toBe(18);
        expect(depthLimitIndex(-0.1)).toBe(-1);
        expect(depthLimitIndex(50000)).toBe(-1);
        expect(depthLimitIndex(NaN)).toBe(-1);
    });
});

describe("buildEcoTaxaDataset", () => {
    test("validated objects only: 1000 × objects / litres per legacy bin, a step curve closed at the deepest depth, most abundant first", () => {
        const dataset = buildEcoTaxaDataset([PROFILE], OPTIONS);

        expect(dataset.keys).toEqual(["Copepoda", "Calanoida", "detritus"]);
        expect(dataset.axis_labels).toEqual({ Copepoda: "Copepoda # m-3", Calanoida: "Calanoida # m-3", detritus: "detritus # m-3" });
        expect(dataset.series.Copepoda).toEqual([{ sample_id: 1, sample_name: "moose_1", positions: [0, 25, 50], values: [2000, 0, 0] }]);
        expect(dataset.series.Calanoida).toEqual([{ sample_id: 1, sample_name: "moose_1", positions: [0, 25, 50], values: [0, 1000, 1000] }]);
        expect(dataset.series.detritus).toEqual([{ sample_id: 1, sample_name: "moose_1", positions: [0, 25, 50], values: [600, 0, 0] }]);
    });

    test("include_predicted: the predicted objects count too, and their categories are offered", () => {
        const dataset = buildEcoTaxaDataset([PROFILE], { ...OPTIONS, include_predicted: true });

        expect(dataset.keys).toEqual(["Copepoda", "Calanoida", "detritus", "Appendicularia"]);
        expect(dataset.series.Calanoida[0].values).toEqual([800, 1000, 1000]);
        expect(dataset.series.Appendicularia[0].values).toEqual([0, 400, 400]);
    });

    test("sum_child_taxa: a category adds the objects of its children among the categories of the selection", () => {
        const dataset = buildEcoTaxaDataset([PROFILE], { ...OPTIONS, sum_child_taxa: true });

        expect(dataset.keys).toEqual(["Copepoda", "Calanoida", "detritus"]);
        expect(dataset.series.Copepoda[0].values).toEqual([2000, 1000, 1000]);
        expect(dataset.series.Calanoida[0].values).toEqual([0, 1000, 1000]);
        expect(dataset.axis_labels.Copepoda).toBe("Copepoda and children # m-3");
    });

    test("sum_child_taxa offers no ancestor without objects of its own", () => {
        const only_child = graphSample(2, [bin(11, 0, 4)], volumes(2.5, 22.5));

        const dataset = buildEcoTaxaDataset([only_child], { ...OPTIONS, sum_child_taxa: true });

        expect(dataset.keys).toEqual(["Calanoida"]);
    });

    test("exclude_not_living drops the categories outside the living ones", () => {
        expect(buildEcoTaxaDataset([PROFILE], { ...OPTIONS, exclude_not_living: true }).keys).toEqual(["Copepoda", "Calanoida"]);
    });

    test("the curve starts at the first depth with volume and stops at the deepest one; a bin without volume is skipped", () => {
        // Volume from 10 to 25 m, then 100-110 m and 150-155 m: nothing between 25 and 100, nor 110-150.
        const sample_volumes = { positions: [...volumes(12.5, 22.5).positions, 102.5, 107.5, 152.5], volumes: [1, 1, 1, 2, 2, 1] };
        const sparse = graphSample(3, [bin(10, 2, 3), bin(10, 21, 4), bin(10, 30, 1), bin(10, 60, 9)], sample_volumes);

        const dataset = buildEcoTaxaDataset([sparse], OPTIONS);

        // 0-25: 3 objects in 3 l; 100-125: 4 in 4 l; 150-200: 1 in 1 l; the 9 objects at 300 m have no volume.
        expect(dataset.series.Copepoda).toEqual([{ sample_id: 3, sample_name: "moose_3", positions: [10, 100, 150, 155], values: [1000, 1000, 1000, 1000] }]);
    });

    test("a sample without any volume, or whose objects all fall where there is none, has no curve", () => {
        const no_volume = graphSample(4, [bin(10, 0, 3)], { positions: [2.5, 7.5], volumes: [0, 0] });
        const elsewhere = graphSample(5, [bin(10, 40, 3)], volumes(2.5, 22.5));

        const dataset = buildEcoTaxaDataset([no_volume, elsewhere, PROFILE], OPTIONS);

        expect(dataset.series.Copepoda.map(series => series.sample_id)).toEqual([1]);
    });

    test("several samples: one curve per sample with objects of the category, totals over the selection order the keys", () => {
        const other = graphSample(6, [bin(30, 0, 50)], volumes(2.5, 22.5, 2));

        const dataset = buildEcoTaxaDataset([PROFILE, other], OPTIONS);

        expect(dataset.keys).toEqual(["Appendicularia", "Copepoda", "Calanoida", "detritus"]);
        expect(dataset.series.Appendicularia).toEqual([{ sample_id: 6, sample_name: "moose_6", positions: [0, 25], values: [5000, 5000] }]);
        expect(dataset.series.Copepoda.map(series => series.sample_id)).toEqual([1]);
    });

    test("objects of an unknown category are left out", () => {
        const unknown = graphSample(7, [bin(999, 0, 8), bin(10, 0, 1)], volumes(2.5, 22.5));

        expect(buildEcoTaxaDataset([unknown], OPTIONS).keys).toEqual(["Copepoda"]);
    });

    test("nothing to draw: an empty dataset", () => {
        expect(buildEcoTaxaDataset([], OPTIONS)).toEqual({ keys: [], axis_labels: {}, series: {} });
    });
});
