import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { GetOneTask } from "../../../../src/domain/use-cases/task/get-one-task";
import { PreparedSearchOptions } from "../../../../src/domain/entities/search";

let mockUserRepository: UserRepository;
let mockTaskRepository: TaskRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockSampleRepository: MockSampleRepository;
let mockProjectRepository: MockProjectRepository;

let getOneTaskUseCase: GetOneTask;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockTaskRepository = new MockTaskRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()

    mockSampleRepository = new MockSampleRepository()
    mockProjectRepository = new MockProjectRepository()

    getOneTaskUseCase = new GetOneTask(mockTaskRepository, mockUserRepository, mockPrivilegeRepository, mockSampleRepository, mockProjectRepository)
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask)
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

        const task = await getOneTaskUseCase.execute(current_user, 1);

        // The server path of the log file never leaves the domain
        expect(task).not.toHaveProperty("task_log_file_path");
        expect(task).toStrictEqual(toPublicTask(TaskResponseModel_1));
        expect(mockTaskRepository.toPublicTask).toBeCalledWith(TaskResponseModel_1);
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

    describe("Exported projects", () => {
        const owner: UserUpdateModel = { user_id: 1 }
        // The database: project 404 was deleted, the others come back sorted by id.
        const standardGetProjects = async (options: PreparedSearchOptions) => {
            const ids = (options.filter[0].value as number[]).filter(id => id !== 404).sort((a, b) => a - b)
            return { items: ids.map(project_id => ({ project_id, project_title: `Project ${project_id}` })), total: ids.length } as any
        }

        beforeEach(() => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(standardGetProjects as any)
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve(
                [{ project_id: 534 }, { project_id: 533 }, { project_id: 534 }, { project_id: 404 }] as any))
        })

        test("Cross-project export : its stored projects, in one query, without reading its samples : ok", async () => {
            const export_task = { ...TaskResponseModel_1, task_type: "EXPORT", task_project_id: undefined, task_params: '{"sample_ids":[1,2,3,4],"project_ids":[534,404,533]}' as any }
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(export_task))

            const task = await getOneTaskUseCase.execute(owner, 1);

            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
            expect(mockProjectRepository.standardGetProjects).toBeCalledTimes(1);
            expect(mockProjectRepository.standardGetProjects).toBeCalledWith({
                filter: [{ field: "project_id", operator: "IN", value: [534, 404, 533] }],
                sort_by: [{ sort_by: "project_id", order_by: "asc" }],
                page: 1,
                limit: 3,
            });
            expect(task.task_projects).toStrictEqual([
                { project_id: 533, project_title: "Project 533" },
                { project_id: 534, project_title: "Project 534" },
            ]);
        });

        test("Cross-project export created before project_ids was stored : the distinct projects of its samples : ok", async () => {
            const export_task = { ...TaskResponseModel_1, task_type: "EXPORT_RAW", task_project_id: undefined, task_params: '{"sample_ids":[1,2,3,4]}' as any }
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(export_task))

            const task = await getOneTaskUseCase.execute(owner, 1);

            expect(mockSampleRepository.getSamplesByIds).toBeCalledWith([1, 2, 3, 4]);
            expect(task.task_projects).toStrictEqual([
                { project_id: 533, project_title: "Project 533" },
                { project_id: 534, project_title: "Project 534" },
            ]);
        });

        test("Backup export : its own project : ok", async () => {
            const export_task = { ...TaskResponseModel_1, task_type: "EXPORT_BACKUP", task_project_id: 5, task_params: { out_to_ftp: false } }
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(export_task))

            const task = await getOneTaskUseCase.execute(owner, 1);

            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
            expect(task.task_projects).toStrictEqual([{ project_id: 5, project_title: "Project 5" }]);
        });

        test("Export without samples : no project, no query : ok", async () => {
            const export_task = { ...TaskResponseModel_1, task_type: "EXPORT", task_project_id: undefined, task_params: {} }
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(export_task))

            expect((await getOneTaskUseCase.execute(owner, 1)).task_projects).toStrictEqual([]);
            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
            expect(mockProjectRepository.standardGetProjects).toBeCalledTimes(0);
        });

        test("Other task type : no task_projects : ok", async () => {
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))

            expect(await getOneTaskUseCase.execute(owner, 1)).not.toHaveProperty("task_projects");
        });
    });

});