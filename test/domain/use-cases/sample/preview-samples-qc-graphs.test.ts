import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PerImageRecord, SampleSourceQcMetadata } from "../../../../src/domain/entities/sample-qc-graph";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { PreviewSamplesQcGraphs } from "../../../../src/domain/use-cases/sample/preview-samples-qc-graphs";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockProjectRepository: ProjectRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let useCase: PreviewSamplesQcGraphs;

const current_user: UserUpdateModel = { user_id: 1 };

const project = { project_id: 1, root_folder_path: "root/path", instrument_model: "UVP6LP" } as any;

const meta: SampleSourceQcMetadata = {
    filter_first_image: "a",
    filter_last_image: "b",
    instrument_settings_image_volume_l: 2,
    instrument_settings_depth_offset_m: 0,
    sample_type_label: "Depth",
};

const records: PerImageRecord[] = [
    { image_index: 0, image_id: "a", raw_pressure: 0.5, light_on: true, spectrum_counts: { 1: 10 } },
    { image_index: 1, image_id: "b", raw_pressure: 1.5, light_on: true, spectrum_counts: { 1: 20 } },
];

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockSampleRepository = new MockSampleRepository();
    mockProjectRepository = new MockProjectRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    useCase = new PreviewSamplesQcGraphs(mockUserRepository, mockSampleRepository, mockProjectRepository, mockPrivilegeRepository, "data_storage/fss/");

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
    jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
    jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
    jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue([
        { sample_name: "s1" } as any,
        { sample_name: "s2" } as any,
    ]);
    jest.spyOn(mockSampleRepository, "getPerImageRecordsFromSource").mockResolvedValue(records);
    jest.spyOn(mockSampleRepository, "getSourceFilterMetadata").mockResolvedValue(meta);
});

describe("PreviewSamplesQcGraphs", () => {
    test("builds QC graphs from the source folder for importable samples (sample_id null, NOT_IMPORTED)", async () => {
        const res = await useCase.execute(current_user, 1, ["s1"]);

        expect(res).toHaveLength(1);
        expect(res[0].sample_id).toBeNull();
        expect(res[0].sample_name).toBe("s1");
        expect(res[0].visual_qc_status_label).toBe("NOT_IMPORTED");
        expect(res[0].instrument_model).toBe("UVP6LP");
        // Graph 2 — imaged volume = images per bin * image_volume_l (2 L).
        expect(res[0].imaged_volume_profile.series[0].points).toEqual([
            { depth_m: 0.5, value: 2 },
            { depth_m: 1.5, value: 2 },
        ]);
        // Reads straight from the source folder (root_folder_path), not the per-sample storage.
        expect(mockSampleRepository.getPerImageRecordsFromSource).toBeCalledWith("root/path", "s1", "UVP6LP");
        expect(mockSampleRepository.getSourceFilterMetadata).toBeCalledWith("root/path", "s1", "UVP6LP");
    });

    test("rejects a requested name that is not importable, before any file read", async () => {
        await expect(useCase.execute(current_user, 1, ["s1", "sX"])).rejects.toThrow("Samples not importable: sX");
        expect(mockSampleRepository.getPerImageRecordsFromSource).toBeCalledTimes(0);
        expect(mockSampleRepository.getSourceFilterMetadata).toBeCalledTimes(0);
    });

    test("rejects an empty sample list", async () => {
        await expect(useCase.execute(current_user, 1, [])).rejects.toThrow("No samples to preview");
        expect(mockProjectRepository.getProject).toBeCalledTimes(0);
    });

    test("stops when the user cannot be used (no project lookup, no file reads)", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        await expect(useCase.execute(current_user, 1, ["s1"])).rejects.toThrow("User cannot be used");
        expect(mockProjectRepository.getProject).toBeCalledTimes(0);
        expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
    });

    test("stops when the user lacks project access", async () => {
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
        await expect(useCase.execute(current_user, 1, ["s1"])).rejects.toThrow("Logged user cannot access this project");
        expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
    });
});
