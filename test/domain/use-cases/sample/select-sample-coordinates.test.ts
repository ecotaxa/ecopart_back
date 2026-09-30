import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { SelectSampleCoordinates } from "../../../../src/domain/use-cases/sample/select-sample-coordinates";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let useCase: SelectSampleCoordinates;

const current_user: UserUpdateModel = { user_id: 7 };

function sampleStub(overrides: Partial<PublicSampleModel> = {}): PublicSampleModel {
    return { sample_id: 10, sample_name: "s10", project_id: 1, ctd_latitude: 63.3476, ctd_longitude: -20.2736, use_ctd_coordinates: false, ...overrides } as PublicSampleModel;
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockSampleRepository = new MockSampleRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    useCase = new SelectSampleCoordinates(mockUserRepository, mockSampleRepository, mockPrivilegeRepository);

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
});

describe("SelectSampleCoordinates", () => {
    test("selects the CTD coordinates and returns the updated sample", async () => {
        jest.spyOn(mockSampleRepository, "getSample")
            .mockResolvedValueOnce(sampleStub())
            .mockResolvedValueOnce(sampleStub({ use_ctd_coordinates: true }));
        const updateSpy = jest.spyOn(mockSampleRepository, "standardUpdateManySamples").mockResolvedValue(1);

        const res = await useCase.execute(current_user, 1, 10, true);

        expect(updateSpy).toBeCalledWith({ use_ctd_coordinates: true }, { sample_id: 10 });
        expect(res.use_ctd_coordinates).toBe(true);
    });

    test("switches back to the sample coordinates even without CTD coordinates", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ ctd_latitude: null, ctd_longitude: null }));
        const updateSpy = jest.spyOn(mockSampleRepository, "standardUpdateManySamples").mockResolvedValue(1);

        await useCase.execute(current_user, 1, 10, false);

        expect(updateSpy).toBeCalledWith({ use_ctd_coordinates: false }, { sample_id: 10 });
    });

    test("refuses to select CTD coordinates the sample does not have", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ ctd_latitude: null, ctd_longitude: null }));
        const updateSpy = jest.spyOn(mockSampleRepository, "standardUpdateManySamples");

        await expect(useCase.execute(current_user, 1, 10, true)).rejects.toThrow("Sample has no CTD coordinates");
        expect(updateSpy).toBeCalledTimes(0);
    });

    test("stops when the user cannot update samples in the project", async () => {
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
        const getSample = jest.spyOn(mockSampleRepository, "getSample");

        await expect(useCase.execute(current_user, 1, 10, true)).rejects.toThrow("Logged user cannot update samples in this project");
        expect(getSample).toBeCalledTimes(0);
    });

    test("lets an admin update a project they are not a member of", async () => {
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub());
        const updateSpy = jest.spyOn(mockSampleRepository, "standardUpdateManySamples").mockResolvedValue(1);

        await useCase.execute(current_user, 1, 10, true);

        expect(updateSpy).toBeCalledTimes(1);
    });

    test("rejects a sample that does not belong to the project", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub({ project_id: 99 }));
        const updateSpy = jest.spyOn(mockSampleRepository, "standardUpdateManySamples");

        await expect(useCase.execute(current_user, 1, 10, true)).rejects.toThrow("Sample does not belong to project");
        expect(updateSpy).toBeCalledTimes(0);
    });

    test("throws when the sample does not exist", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(null);

        await expect(useCase.execute(current_user, 1, 10, true)).rejects.toThrow("Cannot find sample");
    });

    test("throws when no row was updated", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sampleStub());
        jest.spyOn(mockSampleRepository, "standardUpdateManySamples").mockResolvedValue(0);

        await expect(useCase.execute(current_user, 1, 10, true)).rejects.toThrow("Cannot update sample coordinates selection");
    });
});
