import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { TaskResponseModel_1 } from "../../../entities/task";
import { GetOneTask } from "../../../../src/domain/use-cases/task/get-one-task";

let mockUserRepository: UserRepository;
let mockTaskRepository: TaskRepository;
let mockPrivilegeRepository: PrivilegeRepository;

let getOneTaskUseCase: GetOneTask;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockTaskRepository = new MockTaskRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()

    getOneTaskUseCase = new GetOneTask(mockTaskRepository, mockUserRepository, mockPrivilegeRepository)
})


describe("Get One Task Use Case", () => {
    test("Logged user cannot be used : get a task : ko", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockPrivilegeRepository, "isGranted")

        await expect(getOneTaskUseCase.execute(current_user, 1)).rejects.toThrowError("User cannot be used");

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
    });

    test("Task does not exist : get a task : ko", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockPrivilegeRepository, "isGranted")

        await expect(getOneTaskUseCase.execute(current_user, 1)).rejects.toThrowError("Cannot find task");

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
    });

    test("Logged user is not admin and does not have privilege : get a task : ko", async () => {
        const current_user: UserUpdateModel = {
            user_id: 100
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false))

        await expect(getOneTaskUseCase.execute(current_user, 1)).rejects.toThrowError("User does not have the necessary permissions to access this task.");

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 5 });
    });

    test("Logged user is owner : get a task : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockPrivilegeRepository, "isGranted")

        await getOneTaskUseCase.execute(current_user, 1);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
    });

    test("Logged user is admin : get a task : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 100
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockPrivilegeRepository, "isGranted")

        await getOneTaskUseCase.execute(current_user, 1);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
    });

    test("Logged user is not admin but has privilege : get a task : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 100
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))

        await getOneTaskUseCase.execute(current_user, 1);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockUserRepository.isAdmin).toBeCalledTimes(1);
        expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 5 });
    });

});