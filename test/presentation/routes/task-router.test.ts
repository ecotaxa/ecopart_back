
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
import { MockDeleteTaskUseCase, MockGetOneTaskUseCase, MockSearchTasksUseCase, MockStreamZipFileUseCase, MockGetLogFileTask } from "../../mocks/task-mock";
import { GetLogFileTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/get-log-file-task";
import { SearchTasksResult } from "../../entities/task";


class MockMiddlewareTaskValidation implements IMiddlewareTaskValidation {
    rulesGetInstrumentModels = []
    rulesGetTasks = []
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
            user_creation_date: '2023-08-01 10:30:00',

            iat: 1693237789,
            exp: 1724795389
        } as DecodedToken);
        next();
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

    beforeAll(() => {

        mockMiddlewareAuth = new MockMiddlewareAuth()
        middlewareTaskValidation = new MockMiddlewareTaskValidation()
        deleteTaskUseCase = new MockDeleteTaskUseCase()
        getOneTaskUseCase = new MockGetOneTaskUseCase()
        getLogFileTaskUseCase = new MockGetLogFileTask()
        streamZipFileUseCase = new MockStreamZipFileUseCase()
        searchTaskUseCase = new MockSearchTasksUseCase()

        server.use("/tasks", TaskRouter(mockMiddlewareAuth, middlewareTaskValidation, deleteTaskUseCase, getOneTaskUseCase, getLogFileTaskUseCase, streamZipFileUseCase, searchTaskUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

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
        test("failed if cannot find task file", async () => {
            const expectedResponse = { errors: ["Cannot find task file"] }
            jest.spyOn(streamZipFileUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find task file") })
            const response = await request(server).get("/tasks/1/file")
            expect(response.status).toBe(404)
            expect(streamZipFileUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
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
