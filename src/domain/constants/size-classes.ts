// Detailed size classes of legacy EcoPart (`PartDetClassLimit`, py/part_app/constants.py): 46 ESD
// bounds in mm giving 45 classes, lower bound inclusive, upper bound exclusive, the last one open.
export const PART_DET_CLASS_LIMITS_MM: readonly number[] = [
    0.001, 0.00126, 0.00159, 0.002, 0.00252, 0.00317, 0.004, 0.00504, 0.00635, 0.008,
    0.0101, 0.0127, 0.016, 0.0202, 0.0254, 0.032, 0.0403, 0.0508, 0.064, 0.0806,
    0.102, 0.128, 0.161, 0.203, 0.256, 0.323, 0.406, 0.512, 0.645, 0.813,
    1.02, 1.29, 1.63, 2.05, 2.58, 3.25, 4.1, 5.16, 6.5, 8.19,
    10.3, 13, 16.4, 20.6, 26, 10e7,
];

export const SIZE_CLASS_COUNT = PART_DET_CLASS_LIMITS_MM.length - 1;

// 0-based class of an ESD in mm, -1 below the first bound (1 µm).
export function sizeClassOfEsd(esd_mm: number): number {
    if (!(esd_mm >= PART_DET_CLASS_LIMITS_MM[0])) return -1;
    let low = 0;
    let high = SIZE_CLASS_COUNT - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (esd_mm >= PART_DET_CLASS_LIMITS_MM[mid]) low = mid;
        else high = mid - 1;
    }
    return low;
}

// Column suffix of a class: both bounds in µm followed by `um`, `p` as decimal separator and
// `inf` for the open upper bound, e.g. `50p8um_64um`, `26000um_inf` (decided for the first
// version of the binned export, M4).
export function sizeClassSuffix(class_index: number): string {
    const toUm = (mm: number) => String(Number((mm * 1000).toFixed(3))).replace(".", "p") + "um";
    const upper = class_index === SIZE_CLASS_COUNT - 1 ? "inf" : toUm(PART_DET_CLASS_LIMITS_MM[class_index + 1]);
    return `${toUm(PART_DET_CLASS_LIMITS_MM[class_index])}_${upper}`;
}
