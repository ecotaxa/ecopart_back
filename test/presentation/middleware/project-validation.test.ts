//TODO
import request from "supertest";
import server from '../../../src/server'

import ProjectRouter from '../../../src/presentation/routers/project-router'

import { ProjectResponseModel, ProjectRequestCreationtModel } from "../../../src/domain/entities/project";

import { CreateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/create-project";
import { UpdateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/update-project";
import { DeleteProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/delete-project";
import { SearchProjectsUseCase } from "../../../src/domain/interfaces/use-cases/project/search-project";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { IMiddlewareProjectValidation } from "../../../src/presentation/interfaces/middleware/project-validation";
import { MiddlewareProjectValidation } from "../../../src/presentation/middleware/project-validation";

import { Request, Response, NextFunction } from "express";
import { SearchInfo } from "../../../src/domain/entities/search";
import { projectRequestCreationtModel, projectRequestCreationtModel_withDataSanitized, projectRequestCreationtModel_withDataToSanitize, projectRequestCreationtModel_withmissingData, projectResponseModel, projectUpdateModel, projectUpdateModel_toSanatize } from "../../entities/project";

class MockCreateProjectUseCase implements CreateProjectUseCase {
    execute(): Promise<ProjectResponseModel> {
        throw new Error("Method not implemented.")
    }
}
class MockUpdateProjectUseCase implements UpdateProjectUseCase {
    execute(): Promise<ProjectResponseModel> {
        throw new Error("Method not implemented.")
    }
}

class MockMiddlewareAuth implements MiddlewareAuth {
    auth(_: Request, __: Response, next: NextFunction): void {
        next()
    }
    auth_refresh(): void {
        throw new Error("Method not implemented.")
    }
}

class MockDeleteProjectUseCase implements DeleteProjectUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented.")
    }
}

class MockSearchProjectsUseCase implements SearchProjectsUseCase {
    execute(): Promise<{ projects: ProjectResponseModel[]; search_info: any; }> {
        throw new Error("Method not implemented.")
    }
}
describe("Project Router", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let middlewareProjectValidation: IMiddlewareProjectValidation;
    let mockCreateProjectUseCase: CreateProjectUseCase;
    let mockUpdateProjectUseCase: UpdateProjectUseCase;
    let mockDeleteProjectUseCase: DeleteProjectUseCase;
    let mockSearchProjectsUseCase: SearchProjectsUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        middlewareProjectValidation = new MiddlewareProjectValidation()
        mockCreateProjectUseCase = new MockCreateProjectUseCase()
        mockUpdateProjectUseCase = new MockUpdateProjectUseCase()
        mockDeleteProjectUseCase = new MockDeleteProjectUseCase()
        mockSearchProjectsUseCase = new MockSearchProjectsUseCase()


        server.use("/projects", ProjectRouter(mockMiddlewareAuth, middlewareProjectValidation, mockCreateProjectUseCase, mockDeleteProjectUseCase, mockUpdateProjectUseCase, mockSearchProjectsUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Test project router create project validation", () => {
        test("Create project all params are valid", async () => {
            const InputData: ProjectRequestCreationtModel = projectRequestCreationtModel

            const OutputData: ProjectResponseModel = projectResponseModel
            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Sanitize email and organisation", async () => {
            //TODO affine test on sanitized data
            const InputData: ProjectRequestCreationtModel = projectRequestCreationtModel_withDataToSanitize
            const sanitizedInputData: ProjectRequestCreationtModel = projectRequestCreationtModel_withDataSanitized

            const OutputData: ProjectResponseModel = projectResponseModel

            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateProjectUseCase.execute).toBeCalledWith(undefined, sanitizedInputData)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });


        test("Missing project_title and data_owner_name", async () => {
            const InputData = projectRequestCreationtModel_withmissingData
            //TODO update test
            const OutputData = {
                "errors": [
                    {
                        "location": "body",
                        "msg": "Project title is required.",
                        "path": "project_title",
                        "type": "field",
                        "value": "",
                    },
                    {
                        "location": "body",
                        "msg": "Data owner name is required.",
                        "path": "data_owner_name",
                        "type": "field",
                        "value": "",
                    }
                ]
            }
            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(422)
            expect(mockCreateProjectUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
        });

    })

    describe("Test project router update project validation", () => {
        test("update project all params are valid", async () => {
            const project_to_update = projectUpdateModel
            const OutputData: ProjectResponseModel = projectResponseModel

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).patch("/projects/1").send(project_to_update)

            expect(response.body).toStrictEqual(OutputData)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(mockUpdateProjectUseCase.execute).toBeCalledWith(undefined, { ...project_to_update, project_id: "1" })
            expect(response.status).toBe(200)
        });

        test("Sanitize last_name and first_name", async () => {
            const project_to_update = projectUpdateModel_toSanatize
            const sanitizedInputData = projectUpdateModel

            const OutputData: ProjectResponseModel = projectResponseModel

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).patch("/projects/1").send(project_to_update)
            expect(response.status).toBe(200)
            expect(mockUpdateProjectUseCase.execute).toBeCalledWith(undefined, { ...sanitizedInputData, project_id: "1" })
            expect(response.body).toStrictEqual(OutputData)
        });

    })

    describe("Test project router rules GetProjects", () => {
        test("Get projects all params are valid", async () => {
            const OutputData: { projects: ProjectResponseModel[], search_info: SearchInfo } = {
                projects: [projectResponseModel
                ],
                search_info: { limit: 10, page: 1, pages: 1, total: 1, total_on_page: 1 }

            }
            const options = {
                page: 1,
                limit: 10,
                sort_by: "asc(project_id)"
            }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/projects").query(options)

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
        });

        test("Get projects with invalid page", async () => {
            const options = {
                page: "a",
                limit: 10,
                sort_by: "asc(project_id)"
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
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/projects").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchProjectsUseCase.execute).not.toBeCalled()
        });

        test("Get projects with invalid limit", async () => {
            const options = {
                page: 1,
                limit: "a",
                sort_by: "asc(project_id)"
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
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/projects").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchProjectsUseCase.execute).not.toBeCalled()
        });

        test("get project with default params", async () => {
            const OutputData: { projects: ProjectResponseModel[], search_info: SearchInfo } = {
                projects: [projectResponseModel],
                search_info: { limit: 10, page: 1, pages: 1, total: 1, total_on_page: 1 }

            }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/projects")

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)

        });

    });

})
