import request from "supertest";
import server from '../../../src/server'

import TaskRouter from "../../../src/presentation/routers/tasks-router";

import { MockMiddlewareAuth } from "./project-validation.test";
import { MockDeleteTaskUseCase, MockGetOneTaskUseCase, MockGetLogFileTaskUseCase, MockStreamZipFileUseCase, MockSearchTaskUseCase } from "../../mocks/task-mock";
import { IMiddlewareTaskValidation } from "../../../src/presentation/interfaces/middleware/task-validation";
import { MiddlewareTaskValidation } from "../../../src/presentation/middleware/task-validation";
import { DeleteTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/delete-task";
import { GetLogFileTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/get-log-file-task";
import { GetOneTaskUseCase } from "../../../src/domain/interfaces/use-cases/task/get-one-task";
import { SearchTasksUseCase } from "../../../src/domain/interfaces/use-cases/task/search-task";
import { StreamZipFileUseCase } from "../../../src/domain/interfaces/use-cases/task/stream-zip-file";
import { SearchTasksResult } from "../../entities/task";

describe("Instrument model Router", () => {
    let middlewareTaskValidation: IMiddlewareTaskValidation;

    let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockDeleteTaskUseCase: DeleteTaskUseCase
    let mockGetOneTaskUseCase: GetOneTaskUseCase
    let mockGetLogFileTaskUseCase: GetLogFileTaskUseCase
    let mockStreamZipFileUseCase: StreamZipFileUseCase
    let mockSearchTaskUseCase: SearchTasksUseCase

    beforeAll(() => {

        mockMiddlewareAuth = new MockMiddlewareAuth()
        middlewareTaskValidation = new MiddlewareTaskValidation()
        mockDeleteTaskUseCase = new MockDeleteTaskUseCase()
        mockGetOneTaskUseCase = new MockGetOneTaskUseCase()
        mockGetLogFileTaskUseCase = new MockGetLogFileTaskUseCase()
        mockStreamZipFileUseCase = new MockStreamZipFileUseCase()
        mockSearchTaskUseCase = new MockSearchTaskUseCase()

        server.use("/tasks", TaskRouter(mockMiddlewareAuth, middlewareTaskValidation, mockDeleteTaskUseCase, mockGetOneTaskUseCase, mockGetLogFileTaskUseCase, mockStreamZipFileUseCase, mockSearchTaskUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Test task router rules GetUsers", () => {
        test("Get tasks all params are valid", async () => {
            const OutputData = SearchTasksResult
            const options = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }
            jest.spyOn(mockSearchTaskUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/tasks").query(options)

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchTaskUseCase.execute).toBeCalledTimes(1)
        });

        test("Get tasks with invalid page", async () => {
            const options = {
                page: "a",
                limit: 10,
                sort_by: "asc(user_id)"
            }
            const OutputData = {
                "errors": [
                    {
                        "location": "query",
                        "msg": "Page must be a number and must be greater than 0.",
                        "path": "page",
                        "type": "field",
                        "value": "a"
                    }
                ]
            }
            jest.spyOn(mockSearchTaskUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/tasks").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchTaskUseCase.execute).not.toBeCalled()
        });

        test("Get tasks with invalid limit", async () => {
            const options = {
                page: 1,
                limit: "a",
                sort_by: "asc(user_id)"
            }
            const OutputData = {
                "errors": [
                    {
                        "location": "query",
                        "msg": "Limit must be a number and must be greater than 0.",
                        "path": "limit",
                        "type": "field",
                        "value": "a"
                    }
                ]
            }
            jest.spyOn(mockSearchTaskUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/tasks").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchTaskUseCase.execute).not.toBeCalled()
        });

        test("get tasks with default params", async () => {
            const OutputData = SearchTasksResult
            jest.spyOn(mockSearchTaskUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/tasks")

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchTaskUseCase.execute).toBeCalledTimes(1)

        });

    });

})

