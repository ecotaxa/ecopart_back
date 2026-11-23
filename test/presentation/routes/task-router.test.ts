
import request from "supertest";
import server from '../../../src/server'

import TaskRouter from '../../../src/presentation/routers/tasks-router'
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";

import { DeleteTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/delete-task";
import { GetOneTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/get-one-task";
import { SearchTasksUseCase } from "../../../src/domain/interfaces/use-cases/task/search-task";
import { StreamZipFileUseCase } from "../../../src/domain/interfaces/use-cases/task/stream-zip-file";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { IMiddlewareTaskValidation } from '../../../src/presentation/interfaces/middleware/task-validation'

import { Request, Response, NextFunction } from "express";
import { MockDeleteTaskUseCase, MockGetOneTaskUseCase, MockSearchTasksUseCase, MockStreamZipFileUseCase, MockGetLogFileTask, MockCancelTaskUseCase } from "../../mocks/task-mock";
import { CancelTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/cancel-task";
import { GetLogFileTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/get-log-file-task";
import { SearchTasksResult } from "../../entities/task";


class MockMiddlewareTaskValidation implements IMiddlewareTaskValidation {
    rulesGetInstrumentModels = []
    rulesGetTasks = []
    rulesGetTaskLog = []
}
class MockMiddlewareAuth implements MiddlewareAuth {
    auth(req: Request, __: Response, next: NextFunction): void {
        (req as CustomRequest).token = ({
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: false,
            confirmation_code: "123456",
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_utc_date_time: '2023-08-01 10:30:00',

            iat: 1693237789,
            exp: 1724795389
        } as DecodedToken);
        next();
    }
    auth_optional(_: Request, __: Response, next: NextFunction): void {
        next()
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh");
    }
}

describe('TaskRouter', () => {
    let mockMiddlewareAuth: MiddlewareAuth
    let middlewareTaskValidation: IMiddlewareTaskValidation
    let deleteTaskUseCase: DeleteTaskUseCase
    let getOneTaskUseCase: GetOneTaskUseCase
    let getLogFileTaskUseCase: GetLogFileTaskUseCase
    let streamZipFileUseCase: StreamZipFileUseCase
    let searchTaskUseCase: SearchTasksUseCase
    let cancelTaskUseCase: CancelTaskUseCase

    beforeAll(() => {

        mockMiddlewareAuth = new MockMiddlewareAuth()
        middlewareTaskValidation = new MockMiddlewareTaskValidation()
        deleteTaskUseCase = new MockDeleteTaskUseCase()
        getOneTaskUseCase = new MockGetOneTaskUseCase()
        getLogFileTaskUseCase = new MockGetLogFileTask()
        streamZipFileUseCase = new MockStreamZipFileUseCase()
        searchTaskUseCase = new MockSearchTasksUseCase()
        cancelTaskUseCase = new MockCancelTaskUseCase()

        server.use("/tasks", TaskRouter(mockMiddlewareAuth, middlewareTaskValidation, deleteTaskUseCase, getOneTaskUseCase, getLogFileTaskUseCase, streamZipFileUseCase, searchTaskUseCase, cancelTaskUseCase, 30))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /log_retention", () => {
        test("gives the retention of the logs of successful tasks set on the server, not a task", async () => {
            jest.spyOn(getOneTaskUseCase, "execute")
            const response = await request(server).get("/tasks/log_retention")
            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual({ task_log_retention_days: 30 })
            expect(getOneTaskUseCase.execute).toBeCalledTimes(0)
        });
    });

    describe("Tests for GET /", () => {
        // Test for GET /tasks runs well
        test("Should return 200 with data", async () => {
            const ExpectedData = SearchTasksResult
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/tasks")

            expect(response.status).toBe(200)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });

        // Test for GET /tasks failed
        test("failed if current user cannot be used", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).get("/tasks")
            expect(response.status).toBe(403)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if task type label not found", async () => {
            const expectedResponse = { errors: ["Task type label not found"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task type label not found") })
            const response = await request(server).get("/tasks")
            expect(response.status).toBe(404)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if task status label not found", async () => {
            const expectedResponse = { errors: ["Task status label not found"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task status label not found") })
            const response = await request(server).get("/tasks")
            expect(response.status).toBe(404)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test.each([
            "Unauthorized or unexisting parameters : task_log_file_path",
            "Invalid sorting statement : 'desc(task_id'",
            "Invalid filter statement : 'Missing field, operator, or value in filter: {}'",
        ])("search error %s : ko, 422", async (message) => {
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error(message) })
            const response = await request(server).get("/tasks")
            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual({ errors: [message] })
        });
        test("failed if cannot search tasks", async () => {
            const expectedResponse = { errors: ["Cannot search tasks"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).get("/tasks")
            expect(response.status).toBe(500)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("Tests for GET /searches", () => {
        // Test for POST /tasks/searches runs well
        test("Should return 200 with data", async () => {
            const ExpectedData = SearchTasksResult
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).post("/tasks/searches")

            expect(response.status).toBe(200)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        })

        // Test for POST /tasks/searches failed
        test("failed if current user cannot be used", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).post("/tasks/searches")
            expect(response.status).toBe(403)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if task type label not found", async () => {
            const expectedResponse = { errors: ["Task type label not found"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task type label not found") })
            const response = await request(server).post("/tasks/searches")
            expect(response.status).toBe(404)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if task status label not found", async () => {
            const expectedResponse = { errors: ["Task status label not found"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task status label not found") })
            const response = await request(server).post("/tasks/searches")
            expect(response.status).toBe(404)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if task managing filter value is not valid", async () => {
            const expectedResponse = { errors: ["Task managing filter value is not valid"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task managing filter value is not valid") })
            const response = await request(server).post("/tasks/searches")
            expect(response.status).toBe(422)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot search tasks", async () => {
            const expectedResponse = { errors: ["Cannot search tasks"] }
            jest.spyOn(searchTaskUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).post("/tasks/searches")
            expect(response.status).toBe(500)
            expect(searchTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

    })
    describe("Tests for GET /:task_id", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = SearchTasksResult.tasks[0]
            jest.spyOn(getOneTaskUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/tasks/1")

            expect(response.status).toBe(200)
            expect(getOneTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });
        test("failed if current user cannot be used", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(getOneTaskUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).get("/tasks/1")
            expect(response.status).toBe(403)
            expect(getOneTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot find task", async () => {
            const expectedResponse = { errors: ["Cannot find task"] }
            jest.spyOn(getOneTaskUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find task") })
            const response = await request(server).get("/tasks/1")
            expect(response.status).toBe(404)
            expect(getOneTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if user does not have the necessary permissions to access this task", async () => {
            const expectedResponse = { errors: ["Cannot get task"] }
            jest.spyOn(getOneTaskUseCase, "execute").mockImplementation(() => { throw new Error("User does not have the necessary permissions to access this task.") })
            const response = await request(server).get("/tasks/1")
            expect(response.status).toBe(403)
            expect(getOneTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot get task", async () => {
            const expectedResponse = { errors: ["Cannot get task"] }
            jest.spyOn(getOneTaskUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).get("/tasks/1")
            expect(response.status).toBe(500)
            expect(getOneTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })
    describe("Tests for DELETE /:task_id", () => {
        test("Should return 200 with message", async () => {
            jest.spyOn(deleteTaskUseCase, "execute").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).delete("/tasks/1")

            expect(response.status).toBe(200)
            expect(deleteTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ message: "Task 1 successfully deleted" })
        });
        test("forwards the task id only, never the keys of the request body", async () => {
            jest.spyOn(deleteTaskUseCase, "execute").mockImplementation(() => Promise.resolve())
            const response = await request(server).delete("/tasks/1").send({ "task_owner_id = 1 OR 1": 1, task_project_id: 2 })

            expect(response.status).toBe(200)
            expect(deleteTaskUseCase.execute).toBeCalledWith(expect.anything(), { task_id: "1" })
        });
        test("failed if current user cannot be used", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(deleteTaskUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).delete("/tasks/1")
            expect(response.status).toBe(403)
            expect(deleteTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot find task to delete", async () => {
            const expectedResponse = { errors: ["Cannot find task to delete"] }
            jest.spyOn(deleteTaskUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find task to delete") })
            const response = await request(server).delete("/tasks/1")
            expect(response.status).toBe(404)
            expect(deleteTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if logged user cannot delete this task", async () => {
            const expectedResponse = { errors: ["Cannot delete task"] }
            jest.spyOn(deleteTaskUseCase, "execute").mockImplementation(() => { throw new Error("Logged user cannot delete this task") })
            const response = await request(server).delete("/tasks/1")
            expect(response.status).toBe(403)
            expect(deleteTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot delete task", async () => {
            const expectedResponse = { errors: ["Cannot delete task"] }
            jest.spyOn(deleteTaskUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).delete("/tasks/1")
            expect(response.status).toBe(500)
            expect(deleteTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed with 409 if the task is not finished", async () => {
            const expectedResponse = { errors: ["Task 1 is still RUNNING: cancel it before deleting it."] }
            jest.spyOn(deleteTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task 1 is still RUNNING: cancel it before deleting it.") })
            const response = await request(server).delete("/tasks/1")
            expect(response.status).toBe(409)
            expect(deleteTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("Tests for POST /:task_id/cancel", () => {
        test("Should return 200 with the cancelled task", async () => {
            const ExpectedData = { ...SearchTasksResult.tasks[0], task_status: "CANCELLING" }
            jest.spyOn(cancelTaskUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            const response = await request(server).post("/tasks/1/cancel")

            expect(response.status).toBe(200)
            expect(cancelTaskUseCase.execute).toBeCalledTimes(1)
            expect(cancelTaskUseCase.execute).toBeCalledWith(expect.anything(), 1)
            expect(response.body).toStrictEqual(ExpectedData)
        });
        test("failed if current user cannot be used", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(cancelTaskUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).post("/tasks/1/cancel")
            expect(response.status).toBe(403)
            expect(cancelTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot find task", async () => {
            const expectedResponse = { errors: ["Cannot find task"] }
            jest.spyOn(cancelTaskUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find task") })
            const response = await request(server).post("/tasks/1/cancel")
            expect(response.status).toBe(404)
            expect(cancelTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if logged user cannot cancel this task", async () => {
            const expectedResponse = { errors: ["Cannot cancel task"] }
            jest.spyOn(cancelTaskUseCase, "execute").mockImplementation(() => { throw new Error("Logged user cannot cancel this task") })
            const response = await request(server).post("/tasks/1/cancel")
            expect(response.status).toBe(403)
            expect(cancelTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed with 409 if the task cannot be cancelled", async () => {
            const expectedResponse = { errors: ["Task cannot be cancelled"] }
            jest.spyOn(cancelTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task cannot be cancelled") })
            const response = await request(server).post("/tasks/1/cancel")
            expect(response.status).toBe(409)
            expect(cancelTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot cancel task", async () => {
            const expectedResponse = { errors: ["Cannot cancel task"] }
            jest.spyOn(cancelTaskUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).post("/tasks/1/cancel")
            expect(response.status).toBe(500)
            expect(cancelTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("Tests for GET /:task_id/log", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = "log"
            jest.spyOn(getLogFileTaskUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/tasks/1/log")

            expect(response.status).toBe(200)
            expect(getLogFileTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.text).toStrictEqual(ExpectedData)
        });
        test("failed if current user cannot be used", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(getLogFileTaskUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).get("/tasks/1/log")
            expect(response.status).toBe(403)
            expect(getLogFileTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot find task", async () => {
            const expectedResponse = { errors: ["Cannot find task"] }
            jest.spyOn(getLogFileTaskUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find task") })
            const response = await request(server).get("/tasks/1/log")
            expect(response.status).toBe(404)
            expect(getLogFileTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if user does not have the necessary permissions to access this task", async () => {
            const expectedResponse = { errors: ["Cannot get task log"] }
            jest.spyOn(getLogFileTaskUseCase, "execute").mockImplementation(() => { throw new Error("User does not have the necessary permissions to access this task.") })
            const response = await request(server).get("/tasks/1/log")
            expect(response.status).toBe(403)
            expect(getLogFileTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("passes the from offset", async () => {
            jest.spyOn(getLogFileTaskUseCase, "execute").mockImplementation(() => Promise.resolve("next lines\n"))
            const response = await request(server).get("/tasks/1/log?from=120")
            expect(response.status).toBe(200)
            expect(response.text).toBe("next lines\n")
            // Validation rules are empty here: rulesGetTaskLog turns it into a number (task-validation.test.ts)
            expect(getLogFileTaskUseCase.execute).toHaveBeenCalledWith(expect.anything(), 1, "120")
        });
        test("410 once the log of a successful task has expired with no warning to keep", async () => {
            jest.spyOn(getLogFileTaskUseCase, "execute").mockImplementation(() => { throw new Error("Task log expired") })
            const response = await request(server).get("/tasks/1/log")
            expect(response.status).toBe(410)
            expect(response.body).toStrictEqual({ errors: ["The log of this successful task has expired and had no warning to keep: it has been removed"] })
        });
        test("failed if cannot get task log", async () => {
            const expectedResponse = { errors: ["Cannot get task log"] }
            jest.spyOn(getLogFileTaskUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).get("/tasks/1/log")
            expect(response.status).toBe(500)
            expect(getLogFileTaskUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("Tests for GET /:task_id/file", () => {
        test("Should return 200 with data", async () => {
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation((token, taskId, res) => {
                res.status(200).send("Mocked ZIP file content");
                return Promise.resolve();
            });

            const response = await request(server).get("/tasks/1/file");

            expect(response.status).toBe(200);
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1);
        });
        test("failed if current user cannot be used", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(403)
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot find task", async () => {
            const expectedResponse = { errors: ["Cannot find task"] }
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find task") })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(404)
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if ZIP file not found", async () => {
            const expectedResponse = { errors: ["ZIP file not found"] }
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw new Error("ZIP file not found") })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(404)
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("the task folder holds no zip : ko, 404", async () => {
            const expectedResponse = { errors: ["No file found for task 1"] }
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw new Error("No file found for task 1") })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(404)
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("the task folder is gone : ko, 404 without the server path", async () => {
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw Object.assign(new Error("ENOENT: no such file or directory, scandir '/srv/data/tasks/1'"), { code: "ENOENT" }) })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual({ errors: ["ZIP file not found"] })
        });
        test("failed if user does not have the necessary permissions to access this task", async () => {
            const expectedResponse = { errors: ["Cannot get task file"] }
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw new Error("User does not have the necessary permissions to access this task.") })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(403)
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("failed if cannot get task file", async () => {
            const expectedResponse = { errors: ["Cannot get task file"] }
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(500)
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
})
