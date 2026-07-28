import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { PerImageRecord } from "../../../../src/domain/entities/sample-qc-graph";
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
            { image_index: 0, image_id: "a", raw_pressure: 0.5, light_on: true, spectrum_counts: { 1: 10, 2: 5, 3: 2 } },
            { image_index: 1, image_id: "b", raw_pressure: 1.5, light_on: true, spectrum_counts: { 1: 20, 2: 8 } },
            { image_index: 2, image_id: "c", raw_pressure: 1.7, light_on: false, spectrum_counts: { 1: 3, 2: 1, 3: 1 } },
        ];
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub());
        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ project_id: 1, instrument_model: "UVP6LP" } as any);
        jest.spyOn(mockSampleRepository, "getPerImageRecords").mockResolvedValue(records);

        const res = await useCase.execute(current_user, 1, 10);

        expect(res.depth_unit).toBe("m");
        expect(res.instrument_model).toBe("UVP6LP");

        // Graph 2 — imaged volume = images-per-bin * image_volume_l (2 L)
        expect(res.imaged_volume_profile.bin_size_m).toBe(1);
        expect(res.imaged_volume_profile.series[0].points).toEqual([
            { depth_m: 0.5, value: 2 }, // bin 0: 1 image
            { depth_m: 1.5, value: 4 }, // bin 1: 2 images
        ]);

        // Graph 3 — particle (lights on), 3 series 1/2/3 px
        expect(res.particle_lpm_profile.series.map((s) => s.label)).toEqual(["1 px", "2 px", "3 px"]);
        expect(res.particle_lpm_profile.suggested_scale).toBe("log");
        expect(res.particle_lpm_profile.series[0].points).toEqual([{ depth_m: 0.5, value: 10 }, { depth_m: 1.5, value: 20 }]);
        expect(res.particle_lpm_profile.series[2].points).toEqual([{ depth_m: 0.5, value: 2 }, { depth_m: 1.5, value: 0 }]);

        // Graph 3 — black (lights off) present, single bin
        expect(res.black_profile).not.toBeNull();
        expect(res.black_profile?.series[0].points).toEqual([{ depth_m: 1.5, value: 3 }]);

        // Graph 1 — selection range a..b → image c excluded
        expect(res.image_depth_profile.total_images).toBe(3);
        expect(res.image_depth_profile.selected_images).toBe(2);
        expect(res.image_depth_profile.points[2].is_selected).toBe(false);
        expect(res.image_depth_profile.points[0].is_selected).toBe(true);
    });

    test("UVP5: applies 0.1 pressure gain and returns null black_profile (no dark frames)", async () => {
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "1", raw_pressure: 100, light_on: true, spectrum_counts: { 1: 4 } },
        ];
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ filter_first_image: null as any, filter_last_image: null as any }));
        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ project_id: 1, instrument_model: "UVP5HD" } as any);
        jest.spyOn(mockSampleRepository, "getPerImageRecords").mockResolvedValue(records);

        const res = await useCase.execute(current_user, 1, 10);

        expect(res.black_profile).toBeNull();
        // raw_pressure 100 * 0.1 = depth 10 m → bin 10 → centre 10.5
        expect(res.image_depth_profile.points[0].depth_m).toBeCloseTo(10);
        expect(res.particle_lpm_profile.series[0].points[0].depth_m).toBe(10.5);
        // no filter range → everything selected
        expect(res.image_depth_profile.selected_images).toBe(1);
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
