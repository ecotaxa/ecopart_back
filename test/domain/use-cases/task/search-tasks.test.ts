import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { SearchTask } from '../../../../src/domain/use-cases/task/search-tasks';
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSearchRepository } from "../../../mocks/search-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { FilterSearchOptions, SearchOptions } from "../../../../src/domain/entities/search";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";

let mockUserRepository: UserRepository;
let mockTaskRepository: TaskRepository;
let mockSearchRepository: SearchRepository;
let mockProjectRepository: ProjectRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let searchTasksUseCase: SearchTask;


beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockTaskRepository = new MockTaskRepository()
    mockSearchRepository = new MockSearchRepository()
    mockProjectRepository = new MockProjectRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    searchTasksUseCase = new SearchTask(mockUserRepository, mockTaskRepository, mockSearchRepository, mockProjectRepository, mockPrivilegeRepository)
})
describe("Search Task Use Case", () => {
    describe("error cases", () => {

        test("deleted or invalid user should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                limit: 10,
                page: 1,
                sort_by: []
            }
            const filters: FilterSearchOptions[] = []
            const outputError = new Error("User cannot be used")

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(outputError))
            jest.spyOn(mockSearchRepository, "formatFilters")
            jest.spyOn(mockSearchRepository, "formatSortBy")
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "getTasksByUser")
            jest.spyOn(mockUserRepository, "isAdmin")
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchTasksUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(0)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)
        });

        test("search options with invalid Filters should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: []
            }
            const outputError = new Error("Any error")
            const filters = [{ field: "task_status", operator: "=" }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { throw outputError })
            jest.spyOn(mockSearchRepository, "formatSortBy")
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "getTasksByUser")
            jest.spyOn(mockUserRepository, "isAdmin")
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchTasksUseCase.execute(current_user, options, filters as any)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(0)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)

        });
        test("search options with invalid SortBy should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                // sort_by: "asc(user_id)"
                sort_by: "toto"
            }
            const outputError = new Error("Any error")
            const filters = [{ field: "task_id", operator: "=", value: 1 }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { throw outputError })
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "getTasksByUser")
            jest.spyOn(mockUserRepository, "isAdmin")
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchTasksUseCase.execute(current_user, options, filters as any)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(0)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)

        });
        test("search options with invalid task status should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("Task status label not found")
            const filters = [{ field: "task_status", operator: "=", value: "toto" }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus").mockResolvedValue({ total: 0, items: [] })
            jest.spyOn(mockTaskRepository, "standardGetTaskType")
            jest.spyOn(mockTaskRepository, "getTasksByUser")
            jest.spyOn(mockUserRepository, "isAdmin")
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchTasksUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(0)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)

        });
        test("search options with invalid task type should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("Task type label not found")
            const filters = [{ field: "task_type", operator: "=", value: "toto" }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "standardGetTaskType").mockResolvedValue({ total: 0, items: [] })
            jest.spyOn(mockTaskRepository, "getTasksByUser")
            jest.spyOn(mockUserRepository, "isAdmin")
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchTasksUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(1)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(0)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)

        });
        test("search options with invalid task managing filter should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("Task managing filter value is not valid")
            const filters = [{ field: "for_managing", operator: "=", value: "trou" }]

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "standardGetTaskType")
            jest.spyOn(mockTaskRepository, "getTasksByUser")
            jest.spyOn(mockUserRepository, "isAdmin")
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchTasksUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(0)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)
        });

        test("errrors during get tasks, should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("any error")
            const filters = [{ field: "for_managing", operator: "=", value: "true" }]

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "standardGetTaskType")
            jest.spyOn(mockTaskRepository, "getTasksByUser").mockResolvedValue([])
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks").mockRejectedValue(outputError)
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchTasksUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(1)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)
        });
        test("errrors during formatSearchInfo, should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("any error")
            const filters = [{ field: "for_managing", operator: "=", value: "true" }]

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
            jest.spyOn(mockTaskRepository, "standardGetTaskType")
            jest.spyOn(mockTaskRepository, "getTasksByUser").mockResolvedValue([])
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")
            jest.spyOn(mockTaskRepository, "standardGetTasks").mockResolvedValue({ total: 0, items: [] })
            jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { throw outputError })

            await expect(searchTasksUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(1)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(1)
        });
    });
    describe("success cases", () => {
        test("not an admin searching tasks with multiples filters", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const filters = [
                { field: "task_id", operator: "=", value: 1 },
                { field: "task_status", operator: "=", value: "PENDING" },
                { field: "task_type", operator: "=", value: "IMPORT" },
                { field: "for_managing", operator: "=", value: "true" }
            ]

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockTaskRepository, "standardGetTaskStatus").mockResolvedValue({ total: 1, items: [{ task_status_id: 1, task_status_label: "PENDING" }] })
            jest.spyOn(mockTaskRepository, "standardGetTaskType").mockResolvedValue({ total: 1, items: [{ task_type_id: 1, task_type_label: "IMPORT" }] })
            jest.spyOn(mockTaskRepository, "getTasksByUser").mockResolvedValue([])
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false)
            jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockResolvedValue([])
            jest.spyOn(mockTaskRepository, "standardGetTasks").mockResolvedValue({ total: 0, items: [] })
            jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => ({ total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 }));

            await expect(searchTasksUseCase.execute(current_user, options, filters)).resolves.toEqual({ search_info: { total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 }, tasks: [] })

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(1)
            expect(mockTaskRepository.getTasksByUser).toBeCalledTimes(1)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
            expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(1)
            expect(mockTaskRepository.standardGetTasks).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(1)
        });
    });
});
