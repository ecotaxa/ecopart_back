// Consumer-facing README emitted at the root of every raw-data export ZIP.
// Generated from the same column-name constants used by the TSV emitters so the docs
// and the file contents cannot drift apart.

import { RawExportType } from "../../interfaces/use-cases/export/export-raw-data";

const PROJECT_COLUMN_DESCRIPTIONS: Array<[string, string, string]> = [
    // [column, description, origine]
    // The `origine` column tells you where the value actually comes from. For most project
    // fields the source is the EcoPart project-creation form (filled in once by the user),
    // not a per-instrument metadata file — so `—` is used. For instrument-dependent fields
    // the format is "UVP5: <source>. UVP6: <source>."
    ["ecopart_project_id", "Numeric unique ID of the EcoPart project.", "EcoPart DB (auto-increment at project creation)."],
    ["ecopart_project_title", "Project title as displayed in EcoPart.", "EcoPart project-creation form."],
    ["project_total_samples", "Total number of samples in this project (whole project, not just this export).", "EcoPart DB (COUNT over `sample`)."],
    ["project_total_samples_exported", "Number of samples actually exported from this project in this archive.", "Computed at export time from the basket."],
    ["ecotaxa_instance_url", "URL of the EcoTaxa instance the project is linked to. Empty when the project is not linked to EcoTaxa.", "EcoPart `ecotaxa_instance` table (set when the project is linked)."],
    ["ecotaxa_project_id", "Numeric unique ID of the linked EcoTaxa project. Empty when unlinked.", "EcoPart `project.ecotaxa_project_id` (set when the project is linked / created on EcoTaxa)."],
    ["ecotaxa_project_title", "Title of the linked EcoTaxa project. Empty when unlinked.", "EcoPart `project.ecotaxa_project_name`."],
    ["project_total_ecotaxa_samples", "Total number of samples in this project that have been imported into EcoTaxa (whole project).", "EcoPart DB (COUNT over `sample` filtered by `ecotaxa_sample_imported = true`)."],
    ["project_total_ecotaxa_samples_exported", "Number of samples from this project for which EcoTaxa data was truly added to the `ecotaxa/` folder of this export. `0` when the EcoTaxa option was not selected, the project is not linked to an EcoTaxa project, or none of the exported samples have been imported into EcoTaxa.", "Computed at export time."],
    ["project_acronym", "Acronym of the scientific project that funded this deployment.", "EcoPart project-creation form."],
    ["project_description", "Free text describing the project.", "EcoPart project-creation form."],
    ["project_cruise_wmo", "Name of the cruise (or WMO number of the float when deployed from an Argo float).", "EcoPart project-creation form."],
    ["project_ship_floatref", "Name of the ship (or reference of the float).", "EcoPart project-creation form."],
    ["project_data_owner_name", "Name of the data owner — the person in capacity of taking decisions on the diffusion of the data.", "EcoPart project-creation form."],
    ["project_data_owner_email", "Email of the data owner.", "EcoPart project-creation form."],
    ["project_operator_name", "Name of the operator of the instrument on the ship/mooring/etc. — the person capable of informing about the quality of the data, the problems encountered, etc.", "EcoPart project-creation form."],
    ["project_operator_email", "Email of the instrument operator.", "EcoPart project-creation form."],
    ["project_chief_scientist_name", "Name of the chief scientist onboard the cruise — the person responsible for the sampling strategy.", "EcoPart project-creation form."],
    ["project_chief_scientist_email", "Email of the chief scientist.", "EcoPart project-creation form."],
    ["project_instrument", "BODC code of the instrument used (NERC vocabulary URL).", "EcoPart `instrument_model.bodc_url` (looked up from the project's instrument model)."],
    ["project_instrument_model_name", "Instrument model name (e.g. `UVP5HD`, `UVP6LP`).", "EcoPart `instrument_model.instrument_model_name`."],
    ["project_instrument_serial_number", "Serial number of the instrument unit.", "EcoPart project-creation form."],
    ["project_override_depth_offset", "Offset in metres between the pressure sensor and the UVP field of view. Can be provided here or for each sample; this project-level setting overrides the per-sample setting when present.", "EcoPart project-creation form."],
    ["project_enable_descent_filter", "Whether data collected during ascending portions is removed. Useful in regular profiles when the instrument is supposed to be descending regularly but is sometimes going back up because of waves/swell and these portions need to be removed to avoid sampling disturbed water.", "EcoPart project-creation form."],
    ["project_creation_utc_date_time", "ISO UTC timestamp of project creation in EcoPart.", "EcoPart DB (auto at row insert)."],
    ["project_export_utc_date_time", "ISO UTC timestamp of the export event. Same value on every row of the file.", "Captured once at export-task start."],
    ["project_privacy", "Current level of privacy of the project: `private`, `visible`, `public`, or `open`. `private`: only users explicitly added to the project know it exists. `visible`: all users see the project but cannot download it. `public`: particle data can be downloaded. `open`: classifications from EcoTaxa can be downloaded. Informational only — not enforced server-side today.", "Derived at export time from `project_creation_utc_date_time` + the three delays below."],
    ["project_privacy_delay", "Time delay in months since the creation of the project before switching it from `private` to `visible`.", "EcoPart project-creation form."],
    ["project_general_download_delay", "Same delay (months) for switching from `visible` to `public`.", "EcoPart project-creation form."],
    ["project_ecotaxa_classification_download_delay", "Same delay (months) for switching from `public` to `open`.", "EcoPart project-creation form."],
    ["project_managers", "Names and emails of EcoPart project's managers (people allowed to import and modify data in the project). Serialized as `Name <email>; Name <email>`.", "EcoPart `privilege` table joined with `user`."],
    ["project_members", "Names and emails of EcoPart project's members (people allowed to view and export the project's data). Same format as `project_managers`.", "EcoPart `privilege` table joined with `user`."],
];

const SAMPLE_COLUMN_DESCRIPTIONS: Array<[string, string, string]> = [
    // [column, description, origine]
    // The `origine` column gives the per-instrument source. Format: "UVP5: <source>. UVP6: <source>."
    // — or a single line for fields that don't depend on the instrument.
    ["ecopart_project_id", "Parent project identifier (same value as in `projects.tsv`).", "EcoPart DB."],
    ["ecopart_sample_id", "Unique numeric ID for the sample in EcoPart.", "EcoPart DB (auto-increment at sample import)."],
    ["sample_name", "Textual sample ID as filled in during deployment (not necessarily unique at the level of this export).", "UVP5: `meta/uvp5_header_sn*.txt` `profileid`. UVP6: `metadata.ini` `sample_metadata.sample_name`."],
    ["sample_comment", "Free-text comment captured at acquisition.", "UVP5: `meta/uvp5_header_sn*.txt` `comment`. UVP6: `metadata.ini` `sample_metadata.comment`."],
    ["sample_type", "Profile or time based.", "UVP5: derived from `meta_header.yoyo`. UVP6: derived from `metadata.ini` `sampleType`."],
    ["sampling_utc_date_time", "Start time of the sample (ISO UTC).", "UVP5: `meta_header.sampledatetime`. UVP6: `metadata.ini` `sample_metadata.sampledatetime`."],
    ["sample_import_utc_date_time", "ISO UTC timestamp of when the sample was imported into EcoPart.", "EcoPart DB (`sample_creation_utc_date_time`, auto at row insert)."],
    ["sample_max_pressure", "Maximum pressure reached by the instrument during the sample (decibar).", "UVP5: computed from `work/<sample>_datfile.txt`. UVP6: computed from `particules.csv`."],
    ["station_id", "Name of the station within which this sample was taken.", "UVP5: `meta_header.stationid`. UVP6: `metadata.ini` `sample_metadata.stationid`."],
    ["sample_latitude", "Start latitude of the sample (decimal degrees, negative for South).", "UVP5: `meta_header.latitude` (re-processed). UVP6: `metadata.ini` `sample_metadata.latitude` (re-processed)."],
    ["sample_longitude", "Start longitude of the sample (decimal degrees, negative for West).", "UVP5: `meta_header.longitude` (re-processed). UVP6: `metadata.ini` `sample_metadata.longitude` (re-processed)."],
    ["environment_wind_direction", "Wind direction in degrees from North.", "UVP5: `meta_header.winddir`. UVP6: `metadata.ini` `sample_metadata.winddir`."],
    ["environment_sea_state", "Sea-state descriptor — free text, ideally Beaufort scale.", "UVP5: `meta_header.seastate`. UVP6: `metadata.ini` `sample_metadata.seastate`."],
    ["environment_bottom_depth", "Bottom depth in metres.", "UVP5: `meta_header.bottomdepth`. UVP6: `metadata.ini` `sample_metadata.bottom_depth`."],
    ["environment_wind_speed", "Wind speed in knots.", "UVP5: `meta_header.windspeed`. UVP6: `metadata.ini` `sample_metadata.windspeed`."],
    ["environment_nebulousness", "Cloud coverage — free text, ideally coded in 1/8th of the sky covered by clouds.", "UVP5: `meta_header.nebuloussness`. UVP6: `metadata.ini` `sample_metadata.nebuloussness`."],
    ["instrument_operator_email", "Email of the UVP operator for this sample — the person capable of informing about the quality of the data, the problems encountered, etc.", "UVP5: `config/cruise_info.txt` `op_email`. UVP6: `metadata.ini` `HW_CONF.Operator_email`."],
    ["ecotaxa_sample_imported", "True when the sample was imported into EcoTaxa.", "EcoPart DB (set by the EcoTaxa import use case)."],
    ["ecotaxa_sample_import_utc_date_time", "ISO UTC timestamp of the EcoTaxa import.", "EcoPart DB."],
    ["ecotaxa_sample_id", "Unique numeric ID for the sample in EcoTaxa.", "EcoTaxa API (recorded at import time)."],
    ["ecotaxa_sample_tsv_file_name", "EcoTaxa TSV file name.", "EcoPart DB."],
    ["ecotaxa_sample_nb_images", "Number of images uploaded to EcoTaxa.", "EcoPart DB (counted at EcoTaxa import time)."],
    ["ecotaxa_import_status_id", "Numeric EcoTaxa import status.", "EcoPart `ecotaxa_import_status` lookup."],
    ["ecotaxa_import_status_label", "Label form: `IN_PROGRESS`, `SUCCESS`, or `ERROR`.", "EcoPart `ecotaxa_import_status` lookup."],
    ["ecotaxa_sample_task_id", "Internal task identifier for the EcoTaxa import.", "EcoPart `task` table."],
    ["instrument_settings_serial_number", "Serial number of the imager.", "UVP5: extracted from the `uvp5_header_sn(\\d+).txt` filename. UVP6: `metadata.ini` `HW_CONF.Camera_ref`."],
    ["instrument_settings_aa", "Coefficient used for the conversion between size in pixels and in mm² (UVP6: divided by 10^6).", "UVP5: `meta_header.aa`. UVP6: `metadata.ini` `HW_CONF.Aa`."],
    ["instrument_settings_exp", "Coefficient used for the conversion between size in pixels and in mm².", "UVP5: `meta_header.exp`. UVP6: `metadata.ini` `HW_CONF.Exp`."],
    ["instrument_settings_image_volume_l", "Volume of one image, in L.", "UVP5: `meta_header.volimage`. UVP6: `metadata.ini` `HW_CONF.Image_volume`."],
    ["instrument_settings_pixel_size_mm", "Size of the side of one pixel, in mm.", "UVP5: `config/uvp5_settings/uvp5_configuration_data.txt` `Pixel_Size`. UVP6: `metadata.ini` `HW_CONF.Pixel_Size`."],
    ["instrument_settings_depth_offset_m", "Offset, in m, between the pressure sensor and the UVP field of view; can be provided here or at the project level (the project-level setting overrides this one when present).", "UVP5: not currently parsed (empty). UVP6: `metadata.ini` `HW_CONF.Pressure_offset`."],
    ["instrument_settings_acq_pressure_gain", "Multiplicative factor that converts the raw pressure value in the LPM data files to decibar (`raw × pressure_gain = decibar`). UVP5 stores centibar in raw, so `0.1`; UVP6 stores decibar, so `1`. Informational on this export (LPM data is exported in decibar) — kept for the raw-import use case.", "UVP5: constant `0.1`. UVP6: constant `1`."],
    ["instrument_settings_particule_minimum_area_pixels", "Minimum size for the counting and sizing of the objects in the processed image, in pixel².", "UVP5: `work/HDR*.txt` `SMbase`. UVP6: `data.txt` `ACQ_CONF` line (TODO position) converted via Aa/Exp."],
    ["instrument_settings_vignette_minimum_area_pixels", "Minimum size for the saving of the image of the objects detected in the processed image, in pixel².", "UVP5: `work/HDR*.txt` `SMzoo`. UVP6: `data.txt` `ACQ_CONF` line (TODO position) converted via Aa/Exp."],
    ["instrument_settings_acq_shutter_speed", "Shutter code for UVP5SD (`12` = 100 µs = 1/10000 s).", "UVP5: `work/HDR*.txt` `ShutterSpeed`. UVP6: not currently parsed (empty)."],
    ["instrument_settings_acq_gain", "Gain applied to the imager at acquisition.", "UVP5: `work/HDR*.txt` `Gain`. UVP6: `metadata.ini` `HW_CONF.Gain`."],
    ["instrument_settings_acq_x_size", "The X dimension of the imager (pixels).", "UVP5: `config/uvp5_settings/uvp5_configuration_data.txt` `xsize`. UVP6: not currently parsed (empty)."],
    ["instrument_settings_acq_y_size", "The Y dimension of the imager (pixels).", "UVP5: `config/uvp5_settings/uvp5_configuration_data.txt` `ysize`. UVP6: not currently parsed (empty)."],
    ["instrument_settings_acq_description", "Free text describing the acquisition type, e.g. `uvp5hd sn200 : mixtfd`.", "UVP5: 2nd line of `work/HDR*.txt`. UVP6: not currently parsed (empty)."],
    ["instrument_settings_acq_choice", "Flag indicating whether a full image (`0`) or a vignette (`1`) is saved when an object larger than `smzoo` is detected.", "UVP5: `work/HDR*.txt` `Choice`. UVP6: not applicable."],
    ["instrument_settings_acq_disk_type", "Disk type setting: `0` = FD, `1` = HD.", "UVP5: `work/HDR*.txt` `DiskType`. UVP6: not applicable."],
    ["instrument_settings_acq_threshold", "Gray level (0–255 gray scale) segmentation value for the detection of the objects in the processed image.", "UVP5: `work/HDR*.txt` `Thresh`. UVP6: `metadata.ini` `HW_CONF.Threshold`."],
    ["instrument_settings_acq_exposure", "Shutter value in µs (UVP5HD: increased by 60 µs vs the UVPdb 'net' value — important when comparing with UVPdb; UVP6: the value in µs).", "UVP5: `work/HDR*.txt` `Exposure`. UVP6: not currently parsed (empty)."],
    ["instrument_settings_acq_erase_border", "Flag enabling (`1`) or disabling (`0`) the counting of objects touching the sides of the processed image.", "UVP5: `work/HDR*.txt` `EraseBorderBlobs`. UVP6: not currently parsed (empty)."],
    ["instrument_settings_acq_task_type", "UVP5: HDR `TaskType` — enum `-1` error, `0` save only, `1` process only, `2` mixt process, `3` full process. UVP6: not read.", "UVP5: `work/HDR*.txt` `TaskType`. UVP6: not applicable."],
    ["instrument_settings_acq_vignette_roi_enlargement_ratio", "Enlargement ratio for the saving of the vignette — a wider area than the ROI is cropped around each detected object.", "UVP5: `work/HDR*.txt` `Ratio`. UVP6: `metadata.ini` `ACQ_CONF.Appendices_ratio`."],
    ["instrument_settings_process_gamma", "Gamma value for the enhancement of the vignettes for EcoTaxa.", "UVP5: `config/process_install_config.txt` `gamma`. UVP6: `compute_vignettes.txt` `gamma`."],
    ["instrument_settings_process_vignette_resize_factor", "Scale factor used to resize vignettes when saving them.", "UVP5: constant per sub-model (UVP5SD = 2, UVP5HD = 1). UVP6: `compute_vignettes.txt` scale factor (TODO)."],
    ["instrument_settings_process_datetime", "Date of process by Zooprocess (UVP5SD / UVP5HD).", "UVP5: Zooprocess output (TODO — not currently persisted at import, will be empty until wired up). UVP6: not applicable."],
    ["instrument_settings_images_post_process", "Post-process software (`Zooprocess` for UVP5; also `Zooprocess` for UVP6 today, which is erroneous — separate bug).", "Hardcoded at import: UVP5 → `\"zooprocess\"`, UVP6 → `\"uvpapp\"`."],
    ["sample_integration_time", "Integration time in seconds, defined at the sample level in the text file in the meta folder. Set when samples are created in TIME mode in UVPapp; will eventually be replaced by per-bin information from the parsed data at export.", "UVP5: `meta_header.integrationTime` (TODO persist at import). UVP6: not currently parsed (empty)."],
    ["filename", "Raw acquisition filename per UVP metadata.", "UVP5: `meta_header.filename`. UVP6: `metadata.ini` `sample_metadata.filename`."],
    ["filter_first_image", "First image used after frame filtering.", "UVP5: `meta_header.firstimage`. UVP6: `metadata.ini` `sample_metadata.firstimage`."],
    ["filter_last_image", "Last image used after frame filtering.", "UVP5: `meta_header.endimg`. UVP6: `metadata.ini` `sample_metadata.endimg`."],
    ["ctd_original_file_name", "File name as found in the source CTD folder before import.", "EcoPart CTD import flow (basename of the file in `ctd_data_cnv/` (UVP5) or `CTDdata/` (UVP6))."],
    ["ctd_imported_file_name", "File name stored under the per-sample folder post-import.", "EcoPart CTD import flow (file written into the per-sample storage folder)."],
    ["ctd_importator_name", "Display name of the user who ran the CTD import.", "EcoPart `user` table joined via `sample.ctd_importator_user_id`."],
    ["ctd_importator_email", "Email of the CTD importer.", "EcoPart `user` table joined via `sample.ctd_importator_user_id`."],
    ["ctd_import_utc_date_time", "ISO UTC timestamp of the CTD import.", "EcoPart DB (set at CTD import time)."],
    ["ctd_latitude", "Latitude derived from the CTD file (when different from sample latitude).", "CTD file parser (TODO — empty until the parser is wired)."],
    ["ctd_longitude", "Longitude derived from the CTD file (when different from sample longitude).", "CTD file parser (TODO — empty until the parser is wired)."],
    ["visual_qc_status", "Visual QC status (`PENDING`, `VALIDATED`, or `REJECTED`).", "EcoPart `visual_quality_check_status` lookup (set in the QC UI)."],
    ["visual_qc_validator_email", "Email of the QC validator.", "EcoPart `user` table joined via `sample.visual_qc_validator_user_id`."],
    ["number_of_black", "Number of black (lights-off) images at import — noise reference.", "UVP6: counted at import from rows in `particules.csv` where the light flag is `0:1`. UVP5: always `0` by design (UVP5 doesn't acquire black frames)."],
];

function formatTable(rows: Array<[string, string, string]>): string {
    const lines = ["| column | description | origine |", "|---|---|---|"];
    const escape = (s: string) => s.replace(/\|/g, "\\|");
    for (const [name, desc, origine] of rows) {
        lines.push(`| \`${name}\` | ${escape(desc)} | ${escape(origine)} |`);
    }
    return lines.join("\n");
}

export function renderReadme(export_types: RawExportType[]): string {
    const has = (t: RawExportType) => export_types.includes(t);
    const parts: string[] = [];

    parts.push("# EcoPart raw data export");
    parts.push("");
    parts.push("This archive bundles raw data + metadata for the samples you exported. Every TSV is UTF-8, tab-separated, with one header row. Cells with embedded tabs/CR/LF are sanitised to a single space (no quoting). Booleans serialise as `true` / `false`; missing values are empty cells. Timestamps are ISO 8601 UTC.");
    parts.push("");
    parts.push("## Contents");
    parts.push("");
    parts.push("```");
    parts.push("ecopart_export_raw_<task_id>.zip");
    parts.push("├── README.md");
    if (has("metadata")) {
        parts.push("├── metadata/");
        parts.push("│   ├── projects.tsv");
        parts.push("│   └── samples.tsv");
    }
    if (has("lpm")) {
        parts.push("├── lpm/<project_id>/<sample_name>/<instrument-specific raw files>");
    }
    if (has("ctd")) {
        parts.push("├── ctd/<project_id>/<sample_name>.<ext>");
    }
    if (has("ecotaxa")) {
        parts.push("└── ecotaxa/<project_id>/<one file per ecotaxa_project_id>");
    }
    parts.push("```");
    parts.push("");

    if (has("metadata")) {
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
    }

    if (has("lpm")) {
        parts.push("## `lpm/`");
        parts.push("");
        parts.push("Raw per-sample LPM artifacts as produced by the import:");
        parts.push("- **UVP5**: `<sample_name>_work.zip` + `<sample_name>_meta_conf.zip`.");
        parts.push("- **UVP6**: `<sample_name>_Particule.zip` (mandatory) + `<sample_name>_Images.zip` (only when images were imported).");
        parts.push("");
    }

    if (has("ctd")) {
        parts.push("## `ctd/`");
        parts.push("");
        parts.push("CTD files copied as imported. Extension matches the source file (`.ctd` by default).");
        parts.push("");
    }

    if (has("ecotaxa")) {
        parts.push("## `ecotaxa/`");
        parts.push("");
        parts.push("One file per linked EcoTaxa project, produced by calling EcoTaxa's `/object_set/{project_id}/export/general` API. When **Exclude not-living categories** was selected, the export is constrained to the **biota** subtree (`taxo=1&taxochild=Y`). Samples whose project has no linked EcoTaxa project are skipped (a warning line appears in the task log).");
        parts.push("");
    }

    return parts.join("\n");
}
