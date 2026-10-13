// Bin steps of the binned export: the legacy steps as defaults, and the bounds proposed in the
// e-mail of 1 October 2026 (question M6), kept until the team answers.
export const BINNED_DEPTH_STEP_M = { default: 5, min: 1, max: 100 };
export const BINNED_TIME_STEP_H = { default: 1, min: 0.5, max: 24 };

// More bins than this in one sample means a stray pressure or image time (a clock reset, a corrupt
// line): 11 000 m in 1 m bins, or two years of 0.5 h bins, stay well below it.
export const BINNED_MAX_BINS_PER_SAMPLE = 50_000;

// Cell of a value that does not exist: a size class the sample cannot see, a bin without imaged
// volume, a mean grey without particle. `0` stays a counted zero.
export const NA = "NA";
