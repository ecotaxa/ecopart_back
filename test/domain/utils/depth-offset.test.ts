import { effectiveDepthOffset } from "../../../src/domain/utils/depth-offset";

describe("effectiveDepthOffset", () => {
    test.each([
        { override: 1.2, sample: 0.5, expected: 1.2, situation: "the project override wins" },
        { override: 0, sample: 0.5, expected: 0, situation: "a project override of 0 is a real value" },
        { override: null, sample: 0.5, expected: 0.5, situation: "no project override, the sample's offset" },
        { override: undefined, sample: 0, expected: 0, situation: "a sample offset of 0 is a real value" },
        { override: null, sample: null, expected: null, situation: "no offset at all" },
        { override: undefined, sample: undefined, expected: null, situation: "nothing documented" },
    ])("$situation : ok", ({ override, sample, expected }) => {
        expect(effectiveDepthOffset({ override_depth_offset: override }, { instrument_settings_depth_offset_m: sample })).toBe(expected);
    });
});
