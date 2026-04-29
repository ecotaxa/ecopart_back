import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { ImportCTDSamples } from "../../../../src/domain/use-cases/ctd_sample/import-ctd-samples";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1 } from "../../../entities/task";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockProjectRepository: ProjectRepository;
let mockTaskRepository: TaskRepository;
let importCTDSamplesUseCase: ImportCTDSamples;

beforeEach(async () => {
    jest.clearAllMocks();
    mockSampleRepository = new MockSampleRepository()
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockProjectRepository = new MockProjectRepository()
    mockTaskRepository = new MockTaskRepository()

    importCTDSamplesUseCase = new ImportCTDSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository)
})

describe("Import CTD Samples Use Case", () => {
    describe("pre fire-and-forget error scenarios", () => {
        test("should throw an error if the user cannot be used", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")));
            jest.spyOn(mockUserRepository, "isAdmin");
            jest.spyOn(mockPrivilegeRepository, "isGranted");
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockTaskRepository, "createTask");
            jest.spyOn(mockTaskRepository, "getOneTask");
            jest.spyOn(mockTaskRepository, "startTask");
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples");
            jest.spyOn(mockSampleRepository, "importCTDSamples");
            jest.spyOn(mockTaskRepository, "updateTaskProgress");
            jest.spyOn(mockTaskRepository, "finishTask");
            jest.spyOn(mockTaskRepository, "failedTask");

            await expect(importCTDSamplesUseCase.execute(current_user, 1, ["sample_a", "sample_b"])).rejects.toThrow("User cannot be used");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
            expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
            expect(mockTaskRepository.startTask).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledTimes(0);
            expect(mockSampleRepository.importCTDSamples).toBeCalledTimes(0);
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("should throw an error if the user is not admin and not granted on the project", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockTaskRepository, "createTask");
            jest.spyOn(mockTaskRepository, "getOneTask");
            jest.spyOn(mockTaskRepository, "startTask");
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples");
            jest.spyOn(mockSampleRepository, "importCTDSamples");
            jest.spyOn(mockTaskRepository, "updateTaskProgress");
            jest.spyOn(mockTaskRepository, "finishTask");
            jest.spyOn(mockTaskRepository, "failedTask");

            await expect(importCTDSamplesUseCase.execute(current_user, 1, ["sample_a"])).rejects.toThrow("Logged user cannot import CTD samples in this project");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
            expect(mockTaskRepository.startTask).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledTimes(0);
            expect(mockSampleRepository.importCTDSamples).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("should throw an error if the project does not exist", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(null);
            jest.spyOn(mockTaskRepository, "createTask");
            jest.spyOn(mockTaskRepository, "getOneTask");
            jest.spyOn(mockTaskRepository, "startTask");
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples");
            jest.spyOn(mockSampleRepository, "importCTDSamples");
            jest.spyOn(mockTaskRepository, "updateTaskProgress");
            jest.spyOn(mockTaskRepository, "finishTask");
            jest.spyOn(mockTaskRepository, "failedTask");

            await expect(importCTDSamplesUseCase.execute(current_user, 1, ["sample_a"])).rejects.toThrow("Cannot find project");

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
            expect(mockTaskRepository.startTask).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledTimes(0);
            expect(mockSampleRepository.importCTDSamples).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("should throw an error if the task cannot be found after creation", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(42);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(null);
            jest.spyOn(mockTaskRepository, "startTask");
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples");
            jest.spyOn(mockSampleRepository, "importCTDSamples");
            jest.spyOn(mockTaskRepository, "updateTaskProgress");
            jest.spyOn(mockTaskRepository, "finishTask");
            jest.spyOn(mockTaskRepository, "failedTask");

            await expect(importCTDSamplesUseCase.execute(current_user, 1, ["sample_a"])).rejects.toThrow("Cannot find task");

            expect(mockTaskRepository.createTask).toBeCalledTimes(1);
            expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 42 });
            expect(mockTaskRepository.startTask).toBeCalledTimes(0);
            expect(mockSampleRepository.listImportableCTDSamples).toBeCalledTimes(0);
            expect(mockSampleRepository.importCTDSamples).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });
    });

    describe("success scenarios", () => {
        test("should create task and return it — admin access", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };
            const task = { ...TaskResponseModel_1, task_id: 42 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(42);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(task);
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue(undefined);
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples").mockResolvedValue(["sample_a", "sample_b"]);
            jest.spyOn(mockSampleRepository, "importCTDSamples").mockResolvedValue(undefined);
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue(undefined);
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue(undefined);
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue(undefined);

            const result = await importCTDSamplesUseCase.execute(current_user, 1, ["sample_a", "sample_b"]);

            expect(result).toEqual(task);
            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
            expect(mockTaskRepository.createTask).toBeCalledTimes(1);
            expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 42 });
        });

        test("should create task and return it — granted member access", async () => {
            const current_user: UserUpdateModel = { user_id: 2 };
            const task = { ...TaskResponseModel_1, task_id: 99 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(99);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(task);
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue(undefined);
            jest.spyOn(mockSampleRepository, "listImportableCTDSamples").mockResolvedValue(["sample_a"]);
            jest.spyOn(mockSampleRepository, "importCTDSamples").mockResolvedValue(undefined);
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue(undefined);
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue(undefined);
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue(undefined);

            const result = await importCTDSamplesUseCase.execute(current_user, 1, ["sample_a"]);

            expect(result).toEqual(task);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 1 });
            expect(mockTaskRepository.createTask).toBeCalledTimes(1);
            expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 99 });
        });
    });
});
