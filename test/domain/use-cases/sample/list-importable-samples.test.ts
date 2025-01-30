import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { ListImportableSamples } from "../../../../src/domain/use-cases/sample/list-importable-samples";
import { projectResponseModel } from "../../../entities/project";
import { listImportableSamplesResult } from "../../../entities/sample";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockProjectRepository: MockProjectRepository;
let DATA_STORAGE_FS_STORAGE: string;
let listImportableSamplesUseCase: ListImportableSamples;

beforeEach(async () => {
    jest.clearAllMocks();
    mockSampleRepository = new MockSampleRepository()
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockProjectRepository = new MockProjectRepository()
    DATA_STORAGE_FS_STORAGE = "data_storage/files_system_storage/"

    listImportableSamplesUseCase = new ListImportableSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, DATA_STORAGE_FS_STORAGE)
})


describe("Delete Sample Use Case", () => {
    describe("errors senarios", () => {
        test("should throw an error if the user is not valid", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("User cannot be used");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(errorOutput));
            jest.spyOn(mockUserRepository, "isAdmin");
            jest.spyOn(mockPrivilegeRepository, "isManager");
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockSampleRepository, "ensureFolderExists");
            jest.spyOn(mockSampleRepository, "listImportableSamples");

            await expect(listImportableSamplesUseCase.execute(current_user, 1)).rejects.toThrow("User cannot be used");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
            expect(mockPrivilegeRepository.isManager).toBeCalledTimes(0);
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
        });
        test("should throw an error if the user is not admin or net granted on the requested project", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("Logged user cannot list importable samples in this project");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockSampleRepository, "ensureFolderExists");
            jest.spyOn(mockSampleRepository, "listImportableSamples");

            await expect(listImportableSamplesUseCase.execute(current_user, 1)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
        });
        test("should throw an error if the project does not exist", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("Cannot find project");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null));
            jest.spyOn(mockSampleRepository, "ensureFolderExists");
            jest.spyOn(mockSampleRepository, "listImportableSamples");

            await expect(listImportableSamplesUseCase.execute(current_user, 1)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
        });
        test("should throw an error if folder does not exist", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            const errorOutput = new Error("Folder does not exist");

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel));
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockImplementation(() => Promise.reject(errorOutput));
            jest.spyOn(mockSampleRepository, "listImportableSamples");

            await expect(listImportableSamplesUseCase.execute(current_user, 1)).rejects.toThrow(errorOutput);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.ensureFolderExists).toBeCalledWith("root_folder_path");
            expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
        });
    });
    describe("success senarios", () => {
        test("should return [] if no samples are found", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel));
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockImplementation(() => Promise.resolve([]));

            await expect(listImportableSamplesUseCase.execute(current_user, 1)).resolves.toEqual([]);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.ensureFolderExists).toBeCalledWith("root_folder_path");
            expect(mockSampleRepository.listImportableSamples).toBeCalledWith("root_folder_path", "UVP5HD", "data_storage/files_system_storage/1", 1);
        });
        test("should return a list of samples if samples are found  for admin without granted acces", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel));
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockImplementation(() => Promise.resolve(listImportableSamplesResult));

            await expect(listImportableSamplesUseCase.execute(current_user, 1)).resolves.toEqual(listImportableSamplesResult);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.ensureFolderExists).toBeCalledWith("root_folder_path");
            expect(mockSampleRepository.listImportableSamples).toBeCalledWith("root_folder_path", "UVP5HD", "data_storage/files_system_storage/1", 1);

        });
        test("should return a list of samples if samples are found for non admin with granted acces", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel));
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockImplementation(() => Promise.resolve(listImportableSamplesResult));

            await expect(listImportableSamplesUseCase.execute(current_user, 1)).resolves.toEqual(listImportableSamplesResult);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.ensureFolderExists).toBeCalledWith("root_folder_path");
            expect(mockSampleRepository.listImportableSamples).toBeCalledWith("root_folder_path", "UVP5HD", "data_storage/files_system_storage/1", 1);

        });
    });
});