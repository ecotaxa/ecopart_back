// Bin steps of the binned export (question M6, decided by Julie Coustenoble on 4 November 2026).
// Depth: any step from 1 to 100 m, the legacy 5 m by default; the bins start at 0 m, so they
// fall on the same bounds for every profile.
export const BINNED_DEPTH_STEP_M = { default: 5, min: 1, max: 100 };
// Time: a step that divides 24 h, the legacy 1 h by default. The bins are aligned on midnight UTC,
// so they fall on the same bounds for every sample and a 24 h bin is a calendar day.
export const BINNED_TIME_STEP_H = { default: 1, allowed: [0.5, 1, 2, 3, 4, 6, 8, 12, 24] };

export function isBinnedTimeStep(value: number): boolean {
    return BINNED_TIME_STEP_H.allowed.includes(value);
}

// More bins than this in one sample means a stray pressure or image time (a clock reset, a corrupt
// line): 11 000 m in 1 m bins, or two years of 0.5 h bins, stay well below it.
export const BINNED_MAX_BINS_PER_SAMPLE = 50_000;

// Cell of a value that does not exist: a size class the sample cannot see, a bin without imaged
// volume, a mean grey without particle. `0` stays a counted zero.
export const NA = "NA";
