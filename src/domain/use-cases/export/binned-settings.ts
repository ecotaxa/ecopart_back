import { BinnedSampleSettings } from "./binned-computation";

// The sample fields the binned computations read. Structural, so that a stored sample, a sample
// being imported (its type label resolved) or a lighter row fit alike.
export interface BinnedSettingsSampleInputs {
    sample_name: string;
    sample_type_label: string;
    filter_first_image: string | null;
    filter_last_image: string | null;
    instrument_settings_depth_offset_m: number | null | undefined;
    instrument_settings_image_volume_l: number;
    instrument_settings_aa: number;
    instrument_settings_exp: number;
    instrument_settings_particule_minimum_area_pixels: number | null | undefined;
}

export interface BinnedSettingsProjectInputs {
    instrument_model: string;
    enable_descent_filter: boolean;
    override_depth_offset?: number | null;
}

// What the binned export, the particle statistics and the Explore graphs read of a sample and its
// project: the image selection (window, descent filter on depth profiles), depth offset (the project
// override first) and calibration.
export function binnedSampleSettingsOf(sample: BinnedSettingsSampleInputs, project: BinnedSettingsProjectInputs): BinnedSampleSettings {
    return {
        sample_name: sample.sample_name,
        instrument_model: project.instrument_model,
        is_depth_profile: sample.sample_type_label === "Depth",
        descent_filter_enabled: project.enable_descent_filter,
        filter_first_image: sample.filter_first_image ?? null,
        filter_last_image: sample.filter_last_image ?? null,
        depth_offset_m: project.override_depth_offset ?? sample.instrument_settings_depth_offset_m ?? null,
        image_volume_l: sample.instrument_settings_image_volume_l,
        aa: sample.instrument_settings_aa,
        exp: sample.instrument_settings_exp,
        particle_minimum_area_px: sample.instrument_settings_particule_minimum_area_pixels ?? null,
    };
}
