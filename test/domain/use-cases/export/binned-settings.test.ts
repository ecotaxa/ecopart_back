import { SampleRequestCreationModel } from "../../../../src/domain/entities/sample";
import { binnedSampleSettingsOf } from "../../../../src/domain/use-cases/export/binned-settings";
import { private_projectResponseModel, projectResponseModel } from "../../../entities/project";
import { sampleModel_1, sampleModel_2, sampleRequestCreationModel_1 } from "../../../entities/sample";

describe("binnedSampleSettingsOf", () => {
    test("reads the selection, depth offset and calibration of a stored sample and its project", () => {
        // projectResponseModel: UVP5HD, descent filter on, depth offset overridden to 1 m.
        expect(binnedSampleSettingsOf(sampleModel_1, projectResponseModel)).toEqual({
            sample_name: "perle3_001",
            instrument_model: "UVP5HD",
            is_depth_profile: true,
            descent_filter_enabled: true,
            filter_first_image: "2790",
            filter_last_image: "15872",
            depth_offset_m: 1,
            image_volume_l: 1.12,
            aa: 0.003,
            exp: 1.1976,
            particle_minimum_area_px: 2,
        });
    });

    test("only a Depth sample is a depth profile", () => {
        expect(binnedSampleSettingsOf(sampleModel_2, projectResponseModel).is_depth_profile).toBe(false);
        expect(binnedSampleSettingsOf({ ...sampleModel_1, sample_type_label: "Time" }, projectResponseModel).is_depth_profile).toBe(false);
    });

    test("the sample's depth offset applies when the project does not override it, null when neither has one", () => {
        const without_override = { ...projectResponseModel, override_depth_offset: undefined };
        expect(binnedSampleSettingsOf(sampleModel_1, without_override).depth_offset_m).toBe(6);
        expect(binnedSampleSettingsOf(sampleModel_1, { ...without_override, override_depth_offset: null }).depth_offset_m).toBe(6);
        expect(binnedSampleSettingsOf({ ...sampleModel_1, instrument_settings_depth_offset_m: null }, without_override).depth_offset_m).toBeNull();
        // An override of 0 m is an override.
        expect(binnedSampleSettingsOf(sampleModel_1, { ...projectResponseModel, override_depth_offset: 0 }).depth_offset_m).toBe(0);
    });

    test("missing window bounds and minimum area are null", () => {
        const settings = binnedSampleSettingsOf(
            { ...sampleModel_1, filter_first_image: null, filter_last_image: null, instrument_settings_particule_minimum_area_pixels: undefined },
            { ...private_projectResponseModel, enable_descent_filter: false },
        );
        expect(settings).toMatchObject({ filter_first_image: null, filter_last_image: null, particle_minimum_area_px: null, descent_filter_enabled: false });
    });

    test("a sample being imported fits, with its sample type label resolved", () => {
        const sample: SampleRequestCreationModel & { sample_type_label: string } = { ...sampleRequestCreationModel_1, sample_type_label: "Depth" };
        expect(binnedSampleSettingsOf(sample, { instrument_model: "UVP6HF", enable_descent_filter: false })).toEqual({
            sample_name: sampleRequestCreationModel_1.sample_name,
            instrument_model: "UVP6HF",
            is_depth_profile: true,
            descent_filter_enabled: false,
            filter_first_image: "3432",
            filter_last_image: "107843",
            depth_offset_m: 999,
            image_volume_l: 0.63,
            aa: 1130,
            exp: 1.313,
            particle_minimum_area_px: 2,
        });
    });
});
