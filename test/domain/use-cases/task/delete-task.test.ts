import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { TaskResponseModel_1 } from "../../../entities/task";
import { DeleteTask } from "../../../../src/domain/use-cases/task/delete-task";

let mockUserRepository: UserRepository;
let mockTaskRepository: TaskRepository;
let mockPrivilegeRepository: PrivilegeRepository;

let deleteTaskUseCase: DeleteTask;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockTaskRepository = new MockTaskRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()

    deleteTaskUseCase = new DeleteTask(mockUserRepository, mockTaskRepository, mockPrivilegeRepository)
})


describe("Delete Task Use Case", () => {

    test("Logged user is admin : delete a task : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockTaskRepository, "deleteTask").mockImplementation(() => Promise.resolve(1))

        await deleteTaskUseCase.execute(current_user, TaskResponseModel_1);

        expect(mockTaskRepository.getTask).toBeCalledWith(TaskResponseModel_1);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.deleteTask).toBeCalledWith(TaskResponseModel_1);
    });

    test("Logged user is not admin : delete a task : ko", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))

        await expect(deleteTaskUseCase.execute(current_user, TaskResponseModel_1)).rejects.toThrowError("Logged user cannot delete this task");

        expect(mockTaskRepository.getTask).toBeCalledWith(TaskResponseModel_1);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
    });

    test("Logged user is not admin : delete a task : task does not exist", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getTask").mockImplementation(() => Promise.resolve(null))

        await expect(deleteTaskUseCase.execute(current_user, TaskResponseModel_1)).rejects.toThrowError("Cannot find task to delete");

        expect(mockTaskRepository.getTask).toBeCalledWith(TaskResponseModel_1);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
    });

    test("Logged user is admin : delete a task : cannot delete task", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockTaskRepository, "deleteTask").mockImplementation(() => Promise.resolve(0))

        await expect(deleteTaskUseCase.execute(current_user, TaskResponseModel_1)).rejects.toThrowError("Cannot delete task");

        expect(mockTaskRepository.getTask).toBeCalledWith(TaskResponseModel_1);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.deleteTask).toBeCalledWith(TaskResponseModel_1);
    });
});