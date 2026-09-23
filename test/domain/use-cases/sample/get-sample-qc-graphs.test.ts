import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { BinnedDepthProfile, BinnedProfile, PerImageRecord } from "../../../../src/domain/entities/sample-qc-graph";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { GetSampleQcGraphs } from "../../../../src/domain/use-cases/sample/get-sample-qc-graphs";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockProjectRepository: ProjectRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let useCase: GetSampleQcGraphs;

const current_user: UserUpdateModel = { user_id: 1 };

// Minimal sample shaped object — only the fields the use case reads.
function sampleStub(overrides: Partial<PublicSampleModel> = {}): PublicSampleModel {
    return {
        sample_id: 10,
        sample_name: "s10",
        project_id: 1,
        instrument_settings_depth_offset_m: 0,
        instrument_settings_image_volume_l: 2,
        filter_first_image: "a",
        filter_last_image: "b",
        visual_qc_status_label: "PENDING",
        ...overrides,
    } as PublicSampleModel;
}

function depthProfile(profile: BinnedProfile | null): BinnedDepthProfile {
    if (profile === null || profile.axis !== "depth") throw new Error("expected a depth-binned profile");
    return profile;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockSampleRepository = new MockSampleRepository();
    mockProjectRepository = new MockProjectRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    useCase = new GetSampleQcGraphs(mockUserRepository, mockSampleRepository, mockProjectRepository, mockPrivilegeRepository);

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
});

describe("GetSampleQcGraphs", () => {
    test("UVP6: builds depth-binned profiles, splits particle vs black, marks selection", async () => {
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "a", raw_pressure: 0.5, image_time_ms: null, light_on: true, spectrum_counts: { 1: 10, 2: 5, 3: 2 } },
            { image_index: 1, image_id: "b", raw_pressure: 1.5, image_time_ms: null, light_on: true, spectrum_counts: { 1: 20, 2: 8 } },
            { image_index: 2, image_id: "c", raw_pressure: 1.7, image_time_ms: null, light_on: false, spectrum_counts: { 1: 3, 2: 1, 3: 1 } },
            { image_index: 3, image_id: "d", raw_pressure: 2.5, image_time_ms: null, light_on: true, spectrum_counts: { 1: 40 } },
        ];
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ filter_last_image: "c" }));
        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ project_id: 1, instrument_model: "UVP6LP" } as any);
        jest.spyOn(mockSampleRepository, "getPerImageRecords").mockResolvedValue(records);

        const res = await useCase.execute(current_user, 1, 10);

        expect(res.depth_unit).toBe("m");
        expect(res.vertical_axis).toBe("depth");
        expect(res.instrument_model).toBe("UVP6LP");

        // Graph 2 — imaged volume = selected lit images per bin * image_volume_l (2 L): the dark
        // frame c and the out-of-window image d are not counted.
        expect(depthProfile(res.imaged_volume_profile).bin_size_m).toBe(1);
        expect(res.imaged_volume_profile.series[0].points).toEqual([
            { depth_m: 0.5, value: 2 }, // bin 0: image a
            { depth_m: 1.5, value: 2 }, // bin 1: image b
        ]);

        // Graph 3 — particle (lights on), 3 series 1/2/3 px
        expect(res.particle_lpm_profile.series.map((s) => s.label)).toEqual(["1 px", "2 px", "3 px"]);
        expect(res.particle_lpm_profile.suggested_scale).toBe("log");
        expect(res.particle_lpm_profile.series[0].points).toEqual([{ depth_m: 0.5, value: 10 }, { depth_m: 1.5, value: 20 }]);
        expect(res.particle_lpm_profile.series[2].points).toEqual([{ depth_m: 0.5, value: 2 }, { depth_m: 1.5, value: 0 }]);

        // Graph 3 — black (lights off) present, single bin
        expect(res.black_profile).not.toBeNull();
        expect(res.black_profile?.series[0].points).toEqual([{ depth_m: 1.5, value: 3 }]);

        // Graph 1 — selection range a..c → image d excluded
        expect(res.image_depth_profile.total_images).toBe(4);
        expect(res.image_depth_profile.selected_images).toBe(3);
        expect(res.image_depth_profile.points.map((p) => p.is_selected)).toEqual([true, true, true, false]);
    });

    test("UVP5: applies 0.1 pressure gain and returns null black_profile (no dark frames)", async () => {
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "1", raw_pressure: 100, image_time_ms: null, light_on: true, spectrum_counts: { 1: 4 } },
        ];
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ filter_first_image: null as any, filter_last_image: null as any }));
        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ project_id: 1, instrument_model: "UVP5HD" } as any);
        jest.spyOn(mockSampleRepository, "getPerImageRecords").mockResolvedValue(records);

        const res = await useCase.execute(current_user, 1, 10);

        expect(res.black_profile).toBeNull();
        // raw_pressure 100 * 0.1 = depth 10 m → bin 10 → centre 10.5
        expect(res.image_depth_profile.points[0].depth_m).toBeCloseTo(10);
        expect(depthProfile(res.particle_lpm_profile).series[0].points[0].depth_m).toBe(10.5);
        // no filter range → everything selected
        expect(res.image_depth_profile.selected_images).toBe(1);
    });

    test("honours the project's descent filter setting on a depth sample", async () => {
        // depths (UVP5 gain 0.1): 10, 20, 15 (ascent blip), 30.
        const records: PerImageRecord[] = [100, 200, 150, 300].map((raw_pressure, i) => (
            { image_index: i, image_id: String(i + 1), raw_pressure, image_time_ms: null, light_on: true, spectrum_counts: {} }
        ));
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ sample_type_label: "Depth", filter_first_image: "1", filter_last_image: "4" }));
        jest.spyOn(mockSampleRepository, "getPerImageRecords").mockResolvedValue(records);

        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ project_id: 1, instrument_model: "UVP5HD", enable_descent_filter: true } as any);
        const filtered = await useCase.execute(current_user, 1, 10);
        expect(filtered.image_depth_profile.points.map((p) => p.is_selected)).toEqual([true, true, false, true]);
        expect(filtered.image_filtering.removed_images.count).toBe(1);

        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ project_id: 1, instrument_model: "UVP5HD", enable_descent_filter: false } as any);
        const unfiltered = await useCase.execute(current_user, 1, 10);
        expect(unfiltered.image_depth_profile.points.map((p) => p.is_selected)).toEqual([true, true, true, true]);
        expect(unfiltered.image_filtering.removed_images.count).toBe(0);
    });

    test("a time sample is profiled against time (hours), not depth", async () => {
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "20240303-000001-1", raw_pressure: 150, image_time_ms: Date.UTC(2024, 2, 3, 0, 0, 1), light_on: true, spectrum_counts: { 1: 1 } },
            { image_index: 1, image_id: "20240303-040030-1", raw_pressure: 150, image_time_ms: Date.UTC(2024, 2, 3, 4, 0, 30), light_on: true, spectrum_counts: { 1: 2 } },
        ];
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ sample_type_label: "Time", filter_first_image: "0", filter_last_image: "1" }));
        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ project_id: 1, instrument_model: "UVP6LP", enable_descent_filter: true } as any);
        jest.spyOn(mockSampleRepository, "getPerImageRecords").mockResolvedValue(records);

        const res = await useCase.execute(current_user, 1, 10);

        expect(res.vertical_axis).toBe("time");
        expect(res.time_origin_utc_date_time).toBe("2024-03-03T00:00:00.000Z");
        expect(res.imaged_volume_profile.axis).toBe("time");
        expect(res.imaged_volume_profile.series[0].points).toEqual([{ time_h: 0.5, value: 2 }, { time_h: 4.5, value: 2 }]);
        expect(res.image_depth_profile.points.map((p) => p.is_selected)).toEqual([true, true]);
    });

    test("stops when the user cannot be used (no file reads)", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        const getRecords = jest.spyOn(mockSampleRepository, "getPerImageRecords");
        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("User cannot be used");
        expect(getRecords).toBeCalledTimes(0);
    });

    test("stops when the user lacks project access", async () => {
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("Logged user cannot access this project");
    });

    test("rejects a sample that does not belong to the project", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ project_id: 99 }));
        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("Sample does not belong to project");
    });

    test("throws when the sample is not found", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(null);
        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("Cannot find sample");
    });
});
