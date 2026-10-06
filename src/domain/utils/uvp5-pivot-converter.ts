import { Uvp5PivotReport, Uvp5PivotSampleMetadata } from "../entities/pivot";

// UVP5 → UVP6 pivot conversion ("Spec pivot UVP5 vers format UVP6"). Pure: file contents in,
// file contents out. The pivot is a UVP6 `_Particule.zip` (particules.csv + metadata.ini) plus
// `frames.csv`, so every computed product reads one format whatever the instrument.
//
// Incremented whenever the output changes, so that older pivots get regenerated.
export const UVP5_PIVOT_CONVERTER_VERSION = "2";

export interface Uvp5PivotInput {
    sample: Uvp5PivotSampleMetadata;
    instrument_model: string;
    datfile_content: string;
    bru_content: string;
    // The sample's row of meta/uvp5_header_sn*.txt, columns in file order.
    header_row: Record<string, string>;
    // Passed in rather than read from the clock, so that a conversion is reproducible.
    converted_utc: string;
}

export interface Uvp5PivotFiles {
    particules_csv: string;
    metadata_ini: string;
    frames_csv: string;
    report: Uvp5PivotReport;
}

interface AreaBlock {
    nb_particles: number;
    grey_sum: number;
    nb_greys: number;
}

interface DatfileFrame {
    frame_index: number;
    timestamp: string;
    pressure: string;
    // 4th value of the sensor block: the instrument's internal temperature in °C (integer), the same
    // quantity as the UVP6 per-image temperature. Empty when the block has fewer values.
    temperature: string;
    // Object counts the acquisition wrote next to the sensor block (columns 14 and 17 of a
    // `work/` datfile): their sum equals the frame's .bru rows. Null when the row has no `!` marker.
    nb_objects: number | null;
}

// Header columns UVP6 carries in [HW_CONF] rather than in [sample_metadata].
const HEADER_COLUMNS_MOVED_TO_HW_CONF = new Set(["volimage", "aa", "exp"]);

export function convertUvp5ToPivot(input: Uvp5PivotInput): Uvp5PivotFiles {
    const sample_name = input.sample.sample_name;
    const datfile_name = `${sample_name}_datfile.txt`;
    const blocks_by_frame = parseBruBlocksByFrame(input.bru_content);
    const frames = parseDatfile(input.datfile_content);
    if (frames.length === 0) {
        throw new Error(`${datfile_name} contains no frame. Check the work folder of the sample, then relaunch the import or the pivot regeneration.`);
    }

    const first = numericBound(input.sample.filter_first_image);
    const last = numericBound(input.sample.filter_last_image);
    const report: Uvp5PivotReport = {
        sample_name,
        converter_version: UVP5_PIVOT_CONVERTER_VERSION,
        frames_written: 0,
        frames_outside_window: 0,
        empty_frames: 0,
        frames_without_pressure: 0,
        duplicate_image_ids: 0,
        integrity_mismatches: 0,
    };

    const lines: string[] = [];
    const frame_rows: string[] = ["image_id;frame_index"];
    const seen_ids = new Set<string>();
    const datfile_frame_indexes = new Set<number>();
    for (const frame of frames) {
        datfile_frame_indexes.add(frame.frame_index);
        // The operator window is cut here, as UVPapp does for a UVP6; the descent filter is not.
        if ((first !== null && frame.frame_index < first) || (last !== null && frame.frame_index > last)) {
            report.frames_outside_window++;
            continue;
        }
        const image_id = toUvp6ImageId(frame.timestamp);
        if (image_id === null) {
            throw new Error(`frame ${frame.frame_index} of ${datfile_name} has the timestamp "${frame.timestamp}" instead of YYYYMMDDHHMMSS_mmm. Correct this line of the datfile, then relaunch the import or the pivot regeneration.`);
        }
        const pressure = toDecibar(frame.pressure);
        if (pressure === null) {
            throw new Error(`frame ${frame.frame_index} of ${datfile_name} has no readable pressure ("${frame.pressure}"). Correct this line of the datfile, then relaunch the import or the pivot regeneration.`);
        }
        if (seen_ids.has(image_id)) report.duplicate_image_ids++;
        seen_ids.add(image_id);

        const blocks = blocks_by_frame.get(frame.frame_index);
        let nb_particles = 0;
        const block_texts: string[] = [];
        if (blocks) {
            for (const area of Array.from(blocks.keys()).sort((a, b) => a - b)) {
                const block = blocks.get(area) as AreaBlock;
                nb_particles += block.nb_particles;
                const grey_mean = block.nb_greys > 0 ? (block.grey_sum / block.nb_greys).toFixed(1) : "";
                // grey_std stays empty: it is a pixel-level dispersion the .bru does not carry.
                block_texts.push(`${area},${block.nb_particles},${grey_mean},`);
            }
        }
        if (block_texts.length === 0) report.empty_frames++;
        if (frame.nb_objects !== null && frame.nb_objects !== nb_particles) report.integrity_mismatches++;

        // flash = 1: a UVP5 never acquires black images.
        lines.push(`${image_id},${pressure},${frame.temperature},1:${block_texts.join(";")}`);
        frame_rows.push(`${image_id};${frame.frame_index}`);
        report.frames_written++;
    }
    if (report.frames_written === 0) {
        throw new Error(`no frame of ${datfile_name} lies inside [firstimage, endimg] = [${input.sample.filter_first_image}, ${input.sample.filter_last_image}]. Correct firstimage / endimg of the sample in the meta header, then relaunch the import or the pivot regeneration.`);
    }
    for (const frame_index of Array.from(blocks_by_frame.keys())) {
        if (!datfile_frame_indexes.has(frame_index)) report.frames_without_pressure++;
    }

    return {
        particules_csv: lines.join("\n") + "\n",
        metadata_ini: buildMetadataIni(input, report),
        frames_csv: frame_rows.join("\n") + "\n",
        report,
    };
}

// bru1 rows (`frame; blob; area_px; meangrey; x; y`) grouped by frame, then by exact pixel area.
// Scanned with indexOf: a .bru reaches ~100 MB.
function parseBruBlocksByFrame(content: string): Map<number, Map<number, AreaBlock>> {
    const by_frame = new Map<number, Map<number, AreaBlock>>();
    const len = content.length;
    let start = 0;
    while (start < len) {
        let end = content.indexOf("\n", start);
        if (end === -1) end = len;
        const cols = content.slice(start, end).split(";");
        start = end + 1;
        if (cols.length < 4) continue;
        const frame_index = parseInt(cols[0], 10);
        const area = parseInt(cols[2], 10);
        if (isNaN(frame_index) || isNaN(area)) continue;
        const grey = parseInt(cols[3], 10);
        let blocks = by_frame.get(frame_index);
        if (!blocks) { blocks = new Map(); by_frame.set(frame_index, blocks); }
        let block = blocks.get(area);
        if (!block) { block = { nb_particles: 0, grey_sum: 0, nb_greys: 0 }; blocks.set(area, block); }
        block.nb_particles++;
        if (!isNaN(grey)) { block.grey_sum += grey; block.nb_greys++; }
    }
    return by_frame;
}

// Datfile rows: `frame; timestamp; sensor block…!; counts…`. The 12-value sensor block is
// `;`-separated in work/ and results/, one `*`-separated column in raw/: value 1 is the pressure,
// value 4 the internal temperature. Rows whose first column is not a frame index (a title line, a
// blank line) are not frames.
function parseDatfile(content: string): DatfileFrame[] {
    const frames: DatfileFrame[] = [];
    for (const line of content.split(/\r\n|\n|\r/)) {
        const cols = line.split(";").map((c) => c.trim());
        if (cols.length < 3 || !/^\d+$/.test(cols[0])) continue;
        const marker = cols.findIndex((c) => c.endsWith("!"));
        let nb_objects: number | null = null;
        if (marker !== -1 && cols.length > marker + 4) {
            const small = parseInt(cols[marker + 1], 10);
            const large = parseInt(cols[marker + 4], 10);
            if (!isNaN(small) && !isNaN(large)) nb_objects = small + large;
        }
        const sensor = (cols[2].includes("*") ? cols[2].split("*") : cols.slice(2, marker === -1 ? 3 : marker + 1))
            .map((v) => v.trim().replace(/!$/, ""));
        frames.push({
            frame_index: parseInt(cols[0], 10),
            timestamp: cols[1],
            pressure: sensor[0],
            temperature: /^-?\d+$/.test(sensor[3] ?? "") ? String(parseInt(sensor[3], 10)) : "",
            nb_objects,
        });
    }
    return frames;
}

// UVP5 `20200806221354_536` → UVP6 HF form `20200806-221354-536`.
function toUvp6ImageId(timestamp: string): string | null {
    const m = timestamp.match(/^(\d{8})(\d{6})(?:_(\d{1,3}))?$/);
    if (!m) return null;
    return m[3] === undefined ? `${m[1]}-${m[2]}` : `${m[1]}-${m[2]}-${m[3].padStart(3, "0")}`;
}

// Raw UVP5 pressure × 0.1 = decibar, the UVP6 unit. Integer raw values convert exactly to one decimal.
function toDecibar(raw: string): string | null {
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isInteger(value) ? (value / 10).toFixed(1) : String(value / 10);
}

// Same reading as the QC graphs: a non-numeric bound leaves its end of the window open, and the
// `9.9999999999E10` "to the end" sentinel simply lies past the last frame.
function numericBound(bound: string | null | undefined): number | null {
    if (bound === null || bound === undefined || String(bound).trim() === "") return null;
    const n = Number(bound);
    return Number.isFinite(n) ? n : null;
}

// Documentary only: computations read aa, exp, volume and offset from the database, which keeps the
// pivot valid when sample metadata is edited.
function buildMetadataIni(input: Uvp5PivotInput, report: Uvp5PivotReport): string {
    const s = input.sample;
    const hw_conf: [string, string | undefined][] = [
        // UVP6 writes Aa in 1e-6 mm²/px (2300.000 for 0.0023) and Pixel_Size in µm.
        ["Aa", formatNumber(toNumber(s.instrument_settings_aa), (aa) => (aa * 1e6).toFixed(3))],
        ["Exp", formatNumber(toNumber(s.instrument_settings_exp))],
        ["Gain", formatNumber(toNumber(s.instrument_settings_acq_gain))],
        ["Image_volume", formatNumber(toNumber(s.instrument_settings_image_volume_l))],
        ["Pixel_Size", formatNumber(toNumber(s.instrument_settings_pixel_size_mm), (mm) => String(Number((mm * 1000).toFixed(3))))],
        ["Shutter", formatNumber(toNumber(s.instrument_settings_acq_exposure))],
        ["Threshold", formatNumber(toNumber(s.instrument_settings_acq_threshold))],
        // Pressure_offset is omitted on purpose: 0.000 would read as a real zero offset.
    ];
    const sample_metadata = Object.entries(input.header_row).filter(([key]) => !HEADER_COLUMNS_MOVED_TO_HW_CONF.has(key));
    const conversion: [string, string | undefined][] = [
        ["source_instrument", input.instrument_model],
        ["source_archive", `${s.sample_name}_work.zip`],
        ["source_files", `${s.sample_name}_datfile.txt;${s.sample_name}.bru`],
        ["converter_version", report.converter_version],
        ["converted_utc", input.converted_utc],
        ["particle_minimum_area_px", formatNumber(toNumber(s.instrument_settings_particule_minimum_area_pixels))],
        ["temperature_source", "datfile sensor block value 4, internal instrument temperature in degrees Celsius"],
        ["window_applied", `[${s.filter_first_image ?? ""}, ${s.filter_last_image ?? ""}]`],
        ["frames_written", String(report.frames_written)],
        ["frames_outside_window", String(report.frames_outside_window)],
        ["empty_frames", String(report.empty_frames)],
        ["frames_without_pressure", String(report.frames_without_pressure)],
        ["duplicate_image_ids", String(report.duplicate_image_ids)],
        ["integrity_mismatches", String(report.integrity_mismatches)],
    ];
    return [
        iniSection("HW_CONF", hw_conf),
        iniSection("sample_metadata", sample_metadata),
        iniSection("conversion", conversion),
    ].join("\n");
}

function iniSection(name: string, entries: [string, string | undefined][]): string {
    const body = entries.filter(([, value]) => value !== undefined).map(([key, value]) => `${key}=${value}`);
    return [`[${name}]`, ...body, ""].join("\n");
}

// Sample fields read from text files can still be numeric strings (UVP5 `pixel= 0.093`).
function toNumber(value: unknown): number | undefined {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

function formatNumber(value: number | undefined, format: (n: number) => string = String): string | undefined {
    return value === undefined ? undefined : format(value);
}

// One-line summary for task progress messages and logs.
export function describeUvp5PivotReport(report: Uvp5PivotReport): string {
    return `${report.sample_name}: ${report.frames_written} frames written, ${report.frames_outside_window} outside [firstimage, endimg], `
        + `${report.empty_frames} without particle, ${report.frames_without_pressure} .bru frames without pressure, `
        + `${report.duplicate_image_ids} duplicate image ids, ${report.integrity_mismatches} integrity mismatches`;
}

// The sample's row of a UVP5 meta header (`;`-separated, first line = column names), columns in file order.
export function parseUvp5HeaderRow(content: string, sample_name: string): Record<string, string> {
    const lines = content.split(/\r\n|\n|\r/).filter((line) => line.trim() !== "");
    if (lines.length < 2) throw new Error("the meta header contains no data row. Check meta/uvp5_header_sn*.txt, then relaunch the import or the pivot regeneration.");
    const columns = lines[0].split(";").map((c) => c.trim());
    for (const line of lines.slice(1)) {
        const values = line.split(";").map((v) => v.trim());
        const row: Record<string, string> = {};
        columns.forEach((column, i) => { row[column] = values[i] ?? ""; });
        if (row.profileid === sample_name) return row;
    }
    throw new Error(`the meta header has no row for profileid ${sample_name}. Add it to meta/uvp5_header_sn*.txt, then relaunch the import or the pivot regeneration.`);
}
