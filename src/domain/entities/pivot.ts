import { SampleRequestCreationModel } from "./sample";

// Sample fields the UVP5 → UVP6 pivot conversion needs. Both the sample being imported
// (SampleRequestCreationModel) and an already imported one (PublicSampleModel) provide them.
export type Uvp5PivotSampleMetadata = Pick<SampleRequestCreationModel,
    "sample_name"
    | "filter_first_image"
    | "filter_last_image"
    | "instrument_settings_aa"
    | "instrument_settings_exp"
    | "instrument_settings_image_volume_l"
    | "instrument_settings_pixel_size_mm"
    | "instrument_settings_acq_threshold"
    | "instrument_settings_acq_gain"
    | "instrument_settings_acq_exposure"
    | "instrument_settings_particule_minimum_area_pixels"
>;

// What one conversion did, also written into the `[conversion]` section of the pivot metadata.ini.
export interface Uvp5PivotReport {
    sample_name: string;
    converter_version: string;
    frames_written: number;                 // lines of particules.csv
    frames_outside_window: number;          // datfile frames outside [firstimage, endimg]
    empty_frames: number;                   // frames written without any particle block
    frames_without_pressure: number;        // .bru frames absent from the datfile, dropped
    duplicate_image_ids: number;            // frames sharing an image_id with an earlier frame
    integrity_mismatches: number;           // frames whose datfile object counts disagree with the .bru
}

// Regeneration task options: no sample names = every UVP5 sample of the project; `force` also
// rebuilds pivots already at the current converter version.
export interface RegeneratePivotsOptions {
    sample_names?: string[];
    force?: boolean;
}
