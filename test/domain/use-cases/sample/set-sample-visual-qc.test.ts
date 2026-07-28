import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { SetSampleVisualQc } from "../../../../src/domain/use-cases/sample/set-sample-visual-qc";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let useCase: SetSampleVisualQc;

const current_user: UserUpdateModel = { user_id: 7 };

function sampleStub(overrides: Partial<PublicSampleModel> = {}): PublicSampleModel {
    return { sample_id: 10, sample_name: "s10", project_id: 1, visual_qc_status_label: "PENDING", ...overrides } as PublicSampleModel;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockSampleRepository = new MockSampleRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    useCase = new SetSampleVisualQc(mockUserRepository, mockSampleRepository, mockPrivilegeRepository);

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
});

describe("SetSampleVisualQc", () => {
    test("writes status, validator, timestamp and comment, then returns the updated sample", async () => {
        jest.spyOn(mockSampleRepository, "getSample")
            .mockResolvedValueOnce(sampleStub())
            .mockResolvedValueOnce(sampleStub({ visual_qc_status_label: "VALIDATED" }));
        jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue({ visual_qc_status_id: 2, visual_qc_status_label: "VALIDATED" });
        const setSpy = jest.spyOn(mockSampleRepository, "setSampleVisualQc").mockResolvedValue(1);

        const res = await useCase.execute(current_user, 1, 10, "VALIDATED", "looks good");

        expect(setSpy).toBeCalledWith(10, 2, 7, "looks good", expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
        expect(res.visual_qc_status_label).toBe("VALIDATED");
    });

    test("defaults a missing comment to null", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub());
        jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue({ visual_qc_status_id: 3, visual_qc_status_label: "REJECTED" });
        const setSpy = jest.spyOn(mockSampleRepository, "setSampleVisualQc").mockResolvedValue(1);

        await useCase.execute(current_user, 1, 10, "REJECTED");

        expect(setSpy).toBeCalledWith(10, 3, 7, null, expect.any(String));
    });

    test("rejects an invalid status without touching the sample", async () => {
        const getSample = jest.spyOn(mockSampleRepository, "getSample");
        await expect(useCase.execute(current_user, 1, 10, "MAYBE")).rejects.toThrow("Invalid visual QC status");
        expect(getSample).toBeCalledTimes(0);
    });

    test("stops when the user cannot validate in the project", async () => {
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
        const setSpy = jest.spyOn(mockSampleRepository, "setSampleVisualQc");
        await expect(useCase.execute(current_user, 1, 10, "VALIDATED")).rejects.toThrow("Logged user cannot validate samples in this project");
        expect(setSpy).toBeCalledTimes(0);
    });

    test("rejects a sample that does not belong to the project", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ project_id: 99 }));
        await expect(useCase.execute(current_user, 1, 10, "VALIDATED")).rejects.toThrow("Sample does not belong to project");
    });

    test("throws when the QC status label is unknown", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub());
        jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue(null);
        await expect(useCase.execute(current_user, 1, 10, "VALIDATED")).rejects.toThrow("Visual QC status not found");
    });
});
