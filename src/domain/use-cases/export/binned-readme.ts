// Consumer-facing README emitted at the root of every binned export ZIP. Like the raw-data
// README, the column lists come from the constants the TSV writer uses.

import { PARTICLE_CONTEXT_COLUMNS, PIXEL_COLUMNS, SIZE_CLASS_BLOCKS } from "./binned-computation";
import { formatTable, PROJECT_COLUMN_DESCRIPTIONS, SAMPLE_COLUMN_DESCRIPTIONS } from "./readme";
import { BinnedExportBinMode } from "../../entities/binned-export";
import { sizeClassSuffix } from "../../constants/size-classes";

export interface BinnedReadmeOptions {
    bin_mode: BinnedExportBinMode;
    depth_step_m: number;
    time_step_h: number;
    class_indexes: number[];
}

const CONTEXT_COLUMN_DESCRIPTIONS: Record<string, [string, string]> = {
    ecopart_sample_id: ["Sample of the bin: join key to `metadata/samples.tsv`.", ""],
    subsample_utc_date_time_start: ["Depth bins: time of the first image of the bin that adds imaged volume, empty when there is none. Time bins: start of the bin.", "ISO 8601 UTC"],
    subsample_utc_date_time_stop: ["Depth bins: time of the last image of the bin that adds imaged volume, empty when there is none. Time bins: end of the bin.", "ISO 8601 UTC"],
    subsample_depth_start: ["Depth bins: upper bound of the bin (the shallower one). Time bins: mean depth of the images of the bin, empty without pressure.", "m"],
    subsample_depth_stop: ["Depth bins: lower bound of the bin (the deeper one). Time bins: empty.", "m"],
    subsample_nb_images: ["Images of the bin that add imaged volume: the sampling effort behind its counts.", "count"],
    subsample_water_volume: ["Imaged volume of the bin: `subsample_nb_images` × the sample's image volume, rounded to 6 decimals. `0` for a bin crossed without any image that adds volume.", "L"],
    subsample_qcflag: ["Argo quality flag of the bin. Always `0` (no QC performed) in this version.", ""],
    count_1px: ["Particles of exactly 1 pixel in the bin. `NA` when the sample records nothing that small. ⚠️ 1 pixel is not the same size from one instrument to another (for instance 42 µm on the UVP5Z sn002zd, 54 µm on a UVP6 with `Aa` 2300 and `Exp` 1.136, 58 µm on the UVP5HD sn222): compare these counts within one instrument only.", "count"],
    count_2px: ["Particles of exactly 2 pixels in the bin, with the same caveats as `count_1px`.", "count"],
    nb_black_images: ["Black images (lights off, the noise reference) of the bin. `NA` on a UVP5, which never acquires any.", "count"],
};

const BLOCK_DESCRIPTIONS: Record<typeof SIZE_CLASS_BLOCKS[number], [string, string]> = {
    count: ["Particles of the size class in the bin.", "count"],
    concentration: ["`count` / `subsample_water_volume`.", "# L⁻¹"],
    biovolume: ["Σ particles × (ESD / 2)³ × 4π / 3, divided by `subsample_water_volume`.", "mm³ L⁻¹"],
    intensity: ["Mean grey level of the particles of the class, each weighted by its count. `NA` when the class holds no particle. ⚠️ Not comparable between two UVPs: gain, shutter and illumination differ.", "0–255"],
    qcflag: ["Argo quality flag of the class in the bin. Always `0` (no QC performed) in this version.", ""],
};

function columnTable(rows: Array<[string, string, string]>): string {
    const lines = ["| column | description | unit |", "|---|---|---|"];
    const escape = (s: string) => s.replace(/\|/g, "\\|");
    for (const [name, desc, unit] of rows) lines.push(`| \`${name}\` | ${escape(desc)} | ${escape(unit)} |`);
    return lines.join("\n");
}

export function renderBinnedReadme(options: BinnedReadmeOptions): string {
    const parts: string[] = [];
    const mode = {
        auto: "each sample along its own type: depth profiles by depth, time series by time",
        depth: "every sample by depth",
        time: "every sample by time",
    }[options.bin_mode];
    const first_class = options.class_indexes.length > 0 ? sizeClassSuffix(options.class_indexes[0]) : null;

    parts.push("# EcoPart binned export");
    parts.push("");
    parts.push("Particle size spectra of the exported samples, binned by depth or by time and computed by EcoPart from each sample's particle file in the UVP6 format: the file converted at import for a UVP5 sample, the imported `particules.csv` for a UVP6.");
    parts.push("");
    parts.push(`Requested binning: ${mode}; depth bins of ${options.depth_step_m} m, time bins of ${options.time_step_h} h.`);
    parts.push("");
    parts.push("## Contents");
    parts.push("");
    parts.push("```");
    parts.push("ecopart_export_binned_<task_id>.zip");
    parts.push("├── README.md");
    parts.push("├── metadata/");
    parts.push("│   ├── projects.tsv");
    parts.push("│   └── samples.tsv");
    parts.push("└── particles.tsv        one row per bin of each sample");
    parts.push("```");
    parts.push("");
    parts.push("## Conventions");
    parts.push("");
    parts.push("Every TSV is UTF-8, tab-separated, with one header row. Cells with embedded tabs/CR/LF are sanitised to a single space (no quoting). Timestamps are ISO 8601 UTC, the decimal separator is `.`.");
    parts.push("");
    parts.push("In `particles.tsv`:");
    parts.push("- `0` is a counted zero;");
    parts.push("- in the size-class blocks and in `count_1px`, `count_2px`, `nb_black_images`, `NA` means that no value exists: the size class cannot be seen on this sample (below the smallest particle it records, or a class no whole number of pixels falls in), the bin has no imaged volume, a mean grey has no particle to average, or the instrument never acquires black images (UVP5);");
    parts.push("- in the other columns, an empty cell means that the row has no value there or that the column does not apply to it: the times of a depth bin crossed without any image that adds volume, the mean depth of a time bin without pressure, `subsample_depth_stop` of a time bin.");
    parts.push("");
    parts.push("R and pandas read `NA` as a missing value by default. In DuckDB, pass it explicitly: `read_csv('particles.tsv', delim = '\\t', nullstr = ['NA', ''])`.");
    parts.push("");
    parts.push("The position of a sample is in `metadata/samples.tsv` (`sample_latitude`, `sample_longitude`, and `ctd_latitude`, `ctd_longitude` when a CTD file was imported). This version gives no position per bin.");
    parts.push("");
    parts.push("## How the bins are built");
    parts.push("");
    parts.push("- **Images used.** Those inside the operator window [`filter_first_image`, `filter_last_image`], then, on a depth profile whose project enables it, kept by the descent filter (the image is dropped when it is shallower than the deepest image kept so far). They are exactly the images the import QC graphs show as selected.");
    parts.push("- **Imaged volume.** Only lit images add volume. An image the UVP flagged `OVER_EXPOSED` keeps its place in the profile but adds none; an image in which no particle was found (`EMPTY_IMAGE`, or a UVP5 image without particle) adds its volume.");
    parts.push("- **Depth.** Pressure in decibar plus the depth offset (the project override, else the sample's offset); a negative depth is set to 0.");
    parts.push(`- **Depth bins.** Uniform slices of ${options.depth_step_m} m from 0 m: [i × step, (i + 1) × step).`);
    parts.push(`- **Time bins.** Uniform slices of ${options.time_step_h} h from the UTC hour of the first image used.`);
    parts.push("- **Which bins.** Every bin between the first and the last image used is written, even without any image (its `subsample_water_volume` is then `0` and its size-class cells `NA`). Bins outside that range are not written, as in legacy EcoPart.");
    parts.push("- **Size classes.** The 45 classes of legacy EcoPart (`PartDetClassLimit`), named by their bounds in µm, `p` standing for the decimal point: `50p8um_64um` is [50.8 µm, 64 µm), lower bound included, upper bound excluded; the last class is open (`26000um_inf`). The ESD of a particle is 2 × √(area ^ exp × aa / π), `area` in pixels and `aa` in mm² per pixel (the UVP6 `Aa` divided by 10⁶).");
    parts.push(`- **Which classes.** Only the classes visible on at least one exported sample get columns${first_class ? ` (the smallest one here is \`${first_class}\`)` : ""}. On each sample, a class is visible when a whole number of pixels, from the smallest particle the sample records (\`instrument_settings_particule_minimum_area_pixels\`) upwards, falls in it; any other class of that sample is \`NA\`.`);
    parts.push("");
    parts.push("## `particles.tsv`");
    parts.push("");
    parts.push(columnTable([
        ...PARTICLE_CONTEXT_COLUMNS.map((name): [string, string, string] => [name, ...CONTEXT_COLUMN_DESCRIPTIONS[name]]),
        ...PIXEL_COLUMNS.map((name): [string, string, string] => [name, ...CONTEXT_COLUMN_DESCRIPTIONS[name]]),
        ...SIZE_CLASS_BLOCKS.map((block): [string, string, string] => [`${block}_<lower>um_<upper>um`, ...BLOCK_DESCRIPTIONS[block]]),
    ]));
    parts.push("");
    parts.push("## `metadata/projects.tsv`");
    parts.push("");
    parts.push("One row per distinct project across the exported samples.");
    parts.push("");
    parts.push(formatTable(PROJECT_COLUMN_DESCRIPTIONS));
    parts.push("");
    parts.push("## `metadata/samples.tsv`");
    parts.push("");
    parts.push("One row per exported sample, ordered by `(ecopart_project_id, ecopart_sample_id)`.");
    parts.push("");
    parts.push(formatTable(SAMPLE_COLUMN_DESCRIPTIONS));
    parts.push("");
    return parts.join("\n");
}
