import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { CancelTask } from "../../../../src/domain/use-cases/task/cancel-task";

let mockUserRepository: UserRepository;
let mockTaskRepository: TaskRepository;
let cancelTaskUseCase: CancelTask;

// TaskResponseModel_1 is owned by user 1
const running_task = { ...TaskResponseModel_1, task_status_id: 2, task_status: "RUNNING" }
const cancelling_task = { ...TaskResponseModel_1, task_status_id: 7, task_status: "CANCELLING" }

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockTaskRepository = new MockTaskRepository()
    cancelTaskUseCase = new CancelTask(mockTaskRepository, mockUserRepository)
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask)
})

describe("Cancel Task Use Case", () => {
    test("Logged user cannot be used : ko", async () => {
        const current_user: UserUpdateModel = { user_id: 1 }
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"))
        jest.spyOn(mockTaskRepository, "getOneTask")
        jest.spyOn(mockTaskRepository, "cancelTask")

        await expect(cancelTaskUseCase.execute(current_user, 1)).rejects.toThrowError("User cannot be used");

        expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
        expect(mockTaskRepository.cancelTask).toBeCalledTimes(0);
    });

    test("Task does not exist : ko", async () => {
        const current_user: UserUpdateModel = { user_id: 1 }
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(null)
        jest.spyOn(mockTaskRepository, "cancelTask")

        await expect(cancelTaskUseCase.execute(current_user, 1)).rejects.toThrowError("Cannot find task");

        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockTaskRepository.cancelTask).toBeCalledTimes(0);
    });

    test("Logged user is neither the owner nor an admin : ko", async () => {
        const current_user: UserUpdateModel = { user_id: 100 }
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(running_task)
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false)
        jest.spyOn(mockTaskRepository, "cancelTask")

        await expect(cancelTaskUseCase.execute(current_user, 1)).rejects.toThrowError("Logged user cannot cancel this task");

        expect(mockUserRepository.isAdmin).toBeCalledWith(100);
        expect(mockTaskRepository.cancelTask).toBeCalledTimes(0);
    });

    test("Task already finished : the repository refusal is passed on", async () => {
        const current_user: UserUpdateModel = { user_id: 1 }
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(TaskResponseModel_1)
        jest.spyOn(mockTaskRepository, "cancelTask").mockRejectedValue(new Error("Task cannot be cancelled"))

        await expect(cancelTaskUseCase.execute(current_user, 1)).rejects.toThrowError("Task cannot be cancelled");

        expect(mockTaskRepository.cancelTask).toBeCalledWith(1);
    });

    test("Owner cancels a running task : returns the task re-read after the request, without the log path", async () => {
        const current_user: UserUpdateModel = { user_id: 1 }
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValueOnce(running_task).mockResolvedValueOnce(cancelling_task)
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockTaskRepository, "cancelTask").mockResolvedValue()

        const result = await cancelTaskUseCase.execute(current_user, 1);

        expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        expect(mockTaskRepository.cancelTask).toBeCalledWith(1);
        expect(mockTaskRepository.getOneTask).toBeCalledTimes(2);
        expect(result).toStrictEqual(toPublicTask(cancelling_task));
        expect(result).not.toHaveProperty("task_log_file_path");
    });

    test("Admin cancels someone else's task : ok", async () => {
        const current_user: UserUpdateModel = { user_id: 100 }
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValueOnce(running_task).mockResolvedValueOnce(cancelling_task)
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockTaskRepository, "cancelTask").mockResolvedValue()

        await expect(cancelTaskUseCase.execute(current_user, 1)).resolves.toStrictEqual(toPublicTask(cancelling_task));

        expect(mockUserRepository.isAdmin).toBeCalledWith(100);
        expect(mockTaskRepository.cancelTask).toBeCalledWith(1);
    });
});
