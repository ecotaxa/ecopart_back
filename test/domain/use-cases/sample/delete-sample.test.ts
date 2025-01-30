import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { DeleteSample } from "../../../../src/domain/use-cases/sample/delete-sample";
import { sampleModel_1 } from "../../../entities/sample";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;

let deleteSampleUseCase: DeleteSample;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockSampleRepository = new MockSampleRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()

    deleteSampleUseCase = new DeleteSample(mockUserRepository, mockSampleRepository, mockPrivilegeRepository)
})


describe("Delete Sample Use Case", () => {
    describe("errors senarios", () => {
        test("should throw an error if the user is not valid", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("User cannot be used");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(errorOutput));
            jest.spyOn(mockSampleRepository, "getSample");
            jest.spyOn(mockUserRepository, "isAdmin");
            jest.spyOn(mockPrivilegeRepository, "isManager");
            jest.spyOn(mockSampleRepository, "deleteSample");
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage");

            await expect(deleteSampleUseCase.execute(current_user, 1)).rejects.toThrow("User cannot be used");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledTimes(0);
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
            expect(mockPrivilegeRepository.isManager).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSample).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledTimes(0);
        });
        test("should throw an error if the sample to delete does not exist", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("Cannot find sample to delete");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(null));
            jest.spyOn(mockUserRepository, "isAdmin");
            jest.spyOn(mockPrivilegeRepository, "isManager");
            jest.spyOn(mockSampleRepository, "deleteSample");
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage");

            await expect(deleteSampleUseCase.execute(current_user, 1)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
            expect(mockPrivilegeRepository.isManager).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSample).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledTimes(0);
        });
        test("should throw an error if the project_id does not match the sample's project_id", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("The given project_id does not match the sample's project_id");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(sampleModel_1));
            jest.spyOn(mockUserRepository, "isAdmin");
            jest.spyOn(mockPrivilegeRepository, "isManager");
            jest.spyOn(mockSampleRepository, "deleteSample");
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage");

            await expect(deleteSampleUseCase.execute(current_user, 1, 3)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
            expect(mockPrivilegeRepository.isManager).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSample).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledTimes(0);
        });
        test("should throw an error if the user is not admin and does not have manager privilege", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("Logged user cannot delete this sample");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(sampleModel_1));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockSampleRepository, "deleteSample");
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage");

            await expect(deleteSampleUseCase.execute(current_user, 1)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isManager).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_1.project_id });
            expect(mockSampleRepository.deleteSample).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledTimes(0);
        });
        test("should throw an error if the sample cannot be deleted", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("Cannot delete sample");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(sampleModel_1));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockSampleRepository, "deleteSample").mockImplementation(() => Promise.resolve(0));
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage");

            await expect(deleteSampleUseCase.execute(current_user, 1)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isManager).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_1.project_id });
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: 1 });
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledTimes(0);
        });
        test("should throw an error if the sample cannot be deleted from storage", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("Cannot delete sample");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(sampleModel_1));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockSampleRepository, "deleteSample").mockImplementation(() => Promise.resolve(1));
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage").mockImplementation(() => Promise.resolve(0));

            await expect(deleteSampleUseCase.execute(current_user, 1)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isManager).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_1.project_id });
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: 1 });
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledWith(sampleModel_1.sample_name, sampleModel_1.project_id);
        });
    });
    describe("success senarios", () => {
        test("user is admin and do not have manager privilege : delete a sample : ok", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(sampleModel_1));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockSampleRepository, "deleteSample").mockImplementation(() => Promise.resolve(1));
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage").mockImplementation(() => Promise.resolve(1));

            await deleteSampleUseCase.execute(current_user, 1);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isManager).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_1.project_id });
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: 1 });
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledWith(sampleModel_1.sample_name, sampleModel_1.project_id);
        });
        test("user is not admin and have manager privilege : delete a sample : ok", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(sampleModel_1));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockSampleRepository, "deleteSample").mockImplementation(() => Promise.resolve(1));
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage").mockImplementation(() => Promise.resolve(1));

            await deleteSampleUseCase.execute(current_user, 1);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isManager).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_1.project_id });
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: 1 });
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledWith(sampleModel_1.sample_name, sampleModel_1.project_id);
        });
        test("user is admin and wants to delete a sample from a specific project : delete a sample : ok", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation(() => Promise.resolve(sampleModel_1));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockSampleRepository, "deleteSample").mockImplementation(() => Promise.resolve(1));
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage").mockImplementation(() => Promise.resolve(1));

            await deleteSampleUseCase.execute(current_user, 1, 5);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_id: 1 });
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isManager).toBeCalledTimes(1);
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: 1 });
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledWith(sampleModel_1.sample_name, sampleModel_1.project_id);
        });
    });
});