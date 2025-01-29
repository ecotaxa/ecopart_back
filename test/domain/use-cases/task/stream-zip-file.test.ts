import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { TaskResponseModel_1 } from "../../../entities/task";
import { StreamZipFile } from "../../../../src/domain/use-cases/task/stream-zip-file";
import { Response } from "express";


let mockTaskRepository: TaskRepository;
let mockUserRepository: UserRepository;
let mockPrivilegeRepository: PrivilegeRepository;

let streamZipFileTaskUseCase: StreamZipFile;

let mockRes: Response;


beforeEach(async () => {
    jest.clearAllMocks();
    mockTaskRepository = new MockTaskRepository()
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
    } as any

    streamZipFileTaskUseCase = new StreamZipFile(mockTaskRepository, mockUserRepository, mockPrivilegeRepository)
})


describe("Stream zip file Use Case", () => {
    test("Logged user cannot be used : stream zip file : ko", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockPrivilegeRepository, "isGranted")
        jest.spyOn(mockTaskRepository, "getZipFilePath")

        await expect(streamZipFileTaskUseCase.execute(current_user, 1, mockRes)).rejects.toThrowError("User cannot be used");

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
        expect(mockTaskRepository.getZipFilePath).toBeCalledTimes(0);
    });

    test("Task does not exist : stream zip file : ko", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockPrivilegeRepository, "isGranted")
        jest.spyOn(mockTaskRepository, "getZipFilePath")

        await expect(streamZipFileTaskUseCase.execute(current_user, 1, mockRes)).rejects.toThrowError("Cannot find task");

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
        expect(mockTaskRepository.getZipFilePath).toBeCalledTimes(0);

    });

    test("Logged user is not admin and does not have privilege : stream zip file : ko", async () => {
        const current_user: UserUpdateModel = {
            user_id: 100
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockTaskRepository, "getZipFilePath")

        await expect(streamZipFileTaskUseCase.execute(current_user, 1, mockRes)).rejects.toThrowError("User does not have the necessary permissions to access this task.");

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 });
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: 5 });
        expect(mockTaskRepository.getZipFilePath).toBeCalledTimes(0);
    });

});