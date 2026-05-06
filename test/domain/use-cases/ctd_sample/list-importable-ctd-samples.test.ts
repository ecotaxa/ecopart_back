import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { ListImportableCTDSamples } from "../../../../src/domain/use-cases/ctd_sample/list-importable-ctd-samples";
import { projectResponseModel } from "../../../entities/project";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockProjectRepository: ProjectRepository;
let listImportableCTDSamplesUseCase: ListImportableCTDSamples;

beforeEach(async () => {
    jest.clearAllMocks();
    mockSampleRepository = new MockSampleRepository()
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockProjectRepository = new MockProjectRepository()

    listImportableCTDSamplesUseCase = new ListImportableCTDSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository)
})

describe("List importable CTD samples Use Case", () => {
    describe("error scenarios", () => {
        test("should throw an error if the user cannot be used", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")));
            jest.spyOn(mockUserRepository, "isAdmin");
            jest.spyOn(mockPrivilegeRepository, "isGranted");
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples");

            await expect(listImportableCTDSamplesUseCase.execute(current_user, 1)).rejects.toThrow("User cannot be used");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
            expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledTimes(0);
        });

        test("should throw an error if the user is not admin and not granted on the project", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples");

            await expect(listImportableCTDSamplesUseCase.execute(current_user, 1)).rejects.toThrow("Logged user cannot list importable CTD samples in this project");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledTimes(0);
        });

        test("should throw an error if the project does not exist", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null));
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples");

            await expect(listImportableCTDSamplesUseCase.execute(current_user, 1)).rejects.toThrow("Cannot find project");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledTimes(0);
        });

        test("should throw if listImportableCTDSamples fails", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel));
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples").mockImplementation(() => Promise.reject(new Error("Folder does not exist at path: /some/path")));

            await expect(listImportableCTDSamplesUseCase.execute(current_user, 1)).rejects.toThrow("Folder does not exist at path: /some/path");

            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledWith(projectResponseModel.root_folder_path, projectResponseModel.instrument_model, projectResponseModel.project_id);
        });
    });

    describe("success scenarios", () => {
        test("should return [] if no importable CTD samples are found — admin access", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel));
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples").mockImplementation(() => Promise.resolve([]));

            await expect(listImportableCTDSamplesUseCase.execute(current_user, 1)).resolves.toEqual([]);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledWith(projectResponseModel.root_folder_path, projectResponseModel.instrument_model, projectResponseModel.project_id);
        });

        test("should return list of importable CTD samples — granted member access", async () => {
            const current_user: UserUpdateModel = { user_id: 2 };
            const ctd_samples = ["sample_a", "sample_b", "sample_c"];

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel));
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples").mockImplementation(() => Promise.resolve(ctd_samples));

            await expect(listImportableCTDSamplesUseCase.execute(current_user, 1)).resolves.toEqual(ctd_samples);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledWith(projectResponseModel.root_folder_path, projectResponseModel.instrument_model, projectResponseModel.project_id);
        });
    });
});
