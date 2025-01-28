import request from "supertest";
import server from '../../../src/server'

import ProjectRouter from '../../../src/presentation/routers/project-router'

import { PublicProjectRequestCreationModel, PublicProjectResponseModel } from "../../../src/domain/entities/project";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";

import { CreateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/create-project";
import { UpdateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/update-project";
import { DeleteProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/delete-project";
import { SearchProjectsUseCase } from "../../../src/domain/interfaces/use-cases/project/search-project";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { IMiddlewareProjectValidation } from "../../../src/presentation/interfaces/middleware/project-validation";

import { Request, Response, NextFunction } from "express";
import { projectRequestCreationModel, projectResponseModel, projectResponseModelArray, partial_projectUpdateModel } from "../../entities/project";
import { MockCreateProjectUseCase, MockUpdateProjectUseCase, MockSearchProjectsUseCase, MockBackupProjectUseCase, MockExportBackupedProjectUseCase, MockListImportableSamplesUseCase, MockImportSamplesUseCase, MockDeleteSampleUseCase, MockSearchSamplesUseCase } from "../../mocks/project-mock";
import { BackupProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/backup-project";
import { ExportBackupedProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/export-backuped-project";
import { DeleteSampleUseCase } from "../../../src/domain/interfaces/use-cases/sample/delete-sample";
import { ImportSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/import-samples";
import { ListImportableSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/list-importable-samples";
import { SearchSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/search-samples";
import { IMiddlewareSampleValidation } from "../../../src/presentation/interfaces/middleware/sample-validation";
import { TaskResponseModel_1, TaskResponseModel_2 } from "../../entities/task";
import { PublicHeaderSampleResponseModel } from "../../../src/domain/entities/sample";
import { SearchSampleResult } from "../../entities/sample";



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

class MockMiddlewareProjectValidation implements IMiddlewareProjectValidation {
    rulesGetProjects = []
    rulesProjectRequestCreationModel = []
    rulesProjectUpdateModel = []
    rulesProjectBackup = []
    rulesProjectBackupFromImport = []
}

class MockIMiddlewareSampleValidation implements IMiddlewareSampleValidation {
    rulesGetSamples = []
    rulesSampleRequestCreationModel = []
    rulesSampleUpdateModel = []
    rulesSampleBackup = []
    rulesSampleExportBackup = []
    rulesSampleBackupFromImport = []
}


class MockDeleteProjectUseCase implements DeleteProjectUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for DeleteProjectUseCase");
    }
}

describe("Project Router", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let middlewareProjectValidation: MockMiddlewareProjectValidation;
    let middlewareSampleValidation: MockIMiddlewareSampleValidation;
    let mockCreateProjectUseCase: CreateProjectUseCase;
    let mockUpdateProjectUseCase: UpdateProjectUseCase;
    let mockDeleteProjectUseCase: DeleteProjectUseCase;
    let mockSearchProjectsUseCase: SearchProjectsUseCase;
    let mockBackupProjectUseCase: BackupProjectUseCase;
    let mockExportBackupProjectUseCase: ExportBackupedProjectUseCase;
    let mockListImportableSamplesUseCase: ListImportableSamplesUseCase;
    let mockImportSamplesUseCase: ImportSamplesUseCase;
    let mockDeleteSampleUseCase: DeleteSampleUseCase;
    let mockSearchSamplesUseCase: SearchSamplesUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        middlewareProjectValidation = new MockMiddlewareProjectValidation()
        middlewareSampleValidation = new MockIMiddlewareSampleValidation()
        mockCreateProjectUseCase = new MockCreateProjectUseCase()
        mockUpdateProjectUseCase = new MockUpdateProjectUseCase()
        mockDeleteProjectUseCase = new MockDeleteProjectUseCase()
        mockSearchProjectsUseCase = new MockSearchProjectsUseCase()
        mockBackupProjectUseCase = new MockBackupProjectUseCase()
        mockExportBackupProjectUseCase = new MockExportBackupedProjectUseCase()
        mockListImportableSamplesUseCase = new MockListImportableSamplesUseCase()
        mockImportSamplesUseCase = new MockImportSamplesUseCase()
        mockDeleteSampleUseCase = new MockDeleteSampleUseCase()
        mockSearchSamplesUseCase = new MockSearchSamplesUseCase()


        server.use("/projects", ProjectRouter(mockMiddlewareAuth, middlewareProjectValidation, middlewareSampleValidation, mockCreateProjectUseCase, mockDeleteProjectUseCase, mockUpdateProjectUseCase, mockSearchProjectsUseCase, mockBackupProjectUseCase, mockExportBackupProjectUseCase, mockListImportableSamplesUseCase, mockImportSamplesUseCase, mockDeleteSampleUseCase, mockSearchSamplesUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /projects", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                projects: projectResponseModelArray,
                search_info: {
                    total: 2,
                    limit: 10,
                    total_on_page: 2,
                    page: 1,
                    pages: 1
                }
            };
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/projects")

            expect(response.status).toBe(200)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)

        });

        test("failed if current user is deleted", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(403)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("failed if unexisting or unauthorized parameters", async () => {
            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters : Unauthorized sort_by: validemail") })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if invalid sorting statement", async () => {
            const expectedResponse = "Invalid sorting statement"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Invalid sorting statement : 'des'") })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)

            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("Get projects fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Cannot get projects"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(500)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("Tests for POST /projects/searches", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                projects: projectResponseModelArray,
                search_info: {
                    total: 2,
                    limit: 10,
                    total_on_page: 2,
                    page: 1,
                    pages: 1
                }
            };
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(200)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });

        test("failed if current user is deleted", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(403)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("failed if unexisting or unauthorized parameters", async () => {
            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters : Unauthorized sort_by: validemail") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if invalid sorting statement", async () => {
            const expectedResponse = "Invalid sorting statement"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Invalid sorting statement : 'des'") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)

            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if Invalid filter statement ", async () => {
            const expectedResponse = "Invalid filter statement"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Invalid filter statement Value for operator 'IN' must be an array in filter: {field: user_id, operator: IN, value:1 } ") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("Get users fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Cannot search projects"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(500)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("POST /projects", () => {

        test("POST /projects", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
            const OutputData: PublicProjectResponseModel = projectResponseModel

            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).post("/projects").send(InputData)
            expect(response.status).toBe(201)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("POST /projects fail for unexepted reason", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel

            const expectedResponse = { errors: ["Cannot create project"] }

            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error()))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(500)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /projects fail for User is deleted", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
            const expectedResponse = { errors: ["User cannot be used"] }


            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("User cannot be used")))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(403)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });


        test("POST /projects fail for Cannot find the created project. reason", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel

            const expectedResponse = { errors: ["Cannot find the created project."] }


            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot find the created project.")))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(404)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

    })

    describe("PATCH /projects", () => {

        test("PATCH /projects", async () => {
            const project_to_update = partial_projectUpdateModel

            const OutputData: PublicProjectResponseModel = projectResponseModel

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).patch("/projects/1").send(project_to_update)
            expect(response.status).toBe(200)
        });

        test("PATCH /projects fail for unexepted reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Cannot update project"] }

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error()))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(500)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("PATCH /projects fail for User is deleted", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["User is deleted"] }


            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("User is deleted")))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(403)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("PATCH /projects fail for Logged user cannot update this property or project reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Logged user cannot update this property or project"] }


            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Logged user cannot update this property or project")))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });


        test("PATCH /projects fail for Cannot find updated project reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Cannot find updated project"] }


            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot find updated project")))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(404)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("PATCH /projects fail for Unauthorized or unexisting parameters reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters") })
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse))
        });

        test("PATCH /projects fail for Please provide at least one valid parameter to update reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Please provide at least one valid parameter to update"] }
            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => { throw new Error("Please provide at least one valid parameter to update") })
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("PATCH /projects fail for Cannot find updated privileges reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Cannot find updated privileges"] }
            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find updated privileges") })
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(500)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })


    describe("DELETE /projects/:project_id", () => {

        test("DELETE /projects", async () => {
            const expectedResponse = { message: "Project successfully deleted" }

            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /projects fail for User is deleted should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });


        test("DELETE /projects fail for Cannot find project to delete should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find project to delete"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find project to delete")))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /projects fail for Logged user cannot delete this users should return 401", async () => {
            const expectedResponse = { errors: ["Logged user cannot delete this project"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Logged user cannot delete this project")))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /projects fail for Cannot delete project should return 500", async () => {
            const expectedResponse = { errors: ["Cannot delete project"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error()))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })
    describe("POST /projects/:project_id/backup", () => {
        test("POST /projects/:project_id/backup", async () => {
            const expectedResponse = TaskResponseModel_1
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.resolve(expectedResponse))
            const response = await request(server).post("/projects/1/backup")
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(200)
        });
        test("POST /projects/:project_id/backup fail for User is deleted should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /projects/:project_id/backup fail for Logged user cannot list importable samples in this project should return 401", async () => {
            const expectedResponse = { errors: ["Logged user cannot list importable samples in this project"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Logged user cannot list importable samples in this project")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /projects/:project_id/backup fail for Cannot find project to backup should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find project"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find project")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task type not found
        test("POST /projects/:project_id/backup fail for Task type not found should return 404", async () => {
            const expectedResponse = { errors: ["Task type not found"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task type not found")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task status not found
        test("POST /projects/:project_id/backup fail for Task status not found should return 404", async () => {
            const expectedResponse = { errors: ["Task status not found"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task status not found")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot create log file
        test("POST /projects/:project_id/backup fail for Cannot create log file should return 500", async () => {
            const expectedResponse = { errors: ["Cannot create log file"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot create log file")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot find task
        test("POST /projects/:project_id/backup fail for Cannot find task should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find task"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find task")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task not found
        test("POST /projects/:project_id/backup fail for Task not found should return 404", async () => {
            const expectedResponse = { errors: ["Task not found"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task not found")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // An export backup is already running for this project
        test("POST /projects/:project_id/backup fail for An export backup is already running for this project should return 401", async () => {
            const expectedResponse = { errors: ["An export backup is already running for this project"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("An export backup is already running for this project")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Folder does not exist at path
        test("POST /projects/:project_id/backup fail for Folder does not exist at path should return 404", async () => {
            const expectedResponse = { errors: ["Folder does not exist at path"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Folder does not exist at path")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot backup project
        test("POST /projects/:project_id/backup fail for Cannot backup project should return 500", async () => {
            const expectedResponse = { errors: ["Cannot backup project"] }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot backup project")))
            const response = await request(server).post("/projects/1/backup")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });

    describe("POST /projects/:project_id/export", () => {
        test("POST /projects/:project_id/export", async () => {
            const expectedResponse = TaskResponseModel_1
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.resolve(expectedResponse))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(200)
        });
        test("POST /projects/:project_id/export fail for User is deleted should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /projects/:project_id/export fail for Logged user cannot list importable samples in this project should return 401", async () => {
            const expectedResponse = { errors: ["Logged user cannot list importable samples in this project"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Logged user cannot list importable samples in this project")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /projects/:project_id/export fail for Cannot find project to export should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find project"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find project")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task type not found
        test("POST /projects/:project_id/export fail for Task type not found should return 404", async () => {
            const expectedResponse = { errors: ["Task type not found"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task type not found")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task status not found
        test("POST /projects/:project_id/export fail for Task status not found should return 404", async () => {
            const expectedResponse = { errors: ["Task status not found"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task status not found")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot create log file
        test("POST /projects/:project_id/export fail for Cannot create log file should return 500", async () => {
            const expectedResponse = { errors: ["Cannot create log file"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot create log file")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot find task
        test("POST /projects/:project_id/export fail for Cannot find task should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find task"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find task")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        //Backup folder does not exist at path
        test("POST /projects/:project_id/export fail for Backup folder does not exist at path should return 404", async () => {
            const expectedResponse = { errors: ["Backup folder does not exist at path : /path/to/backup"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Backup folder does not exist at path : /path/to/backup")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task not found
        test("POST /projects/:project_id/export fail for Task not found should return 404", async () => {
            const expectedResponse = { errors: ["Task not found"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task not found")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // any other error
        test("POST /projects/:project_id/export fail for any other error should return 500", async () => {
            const expectedResponse = { errors: ["Cannot export backuped project"] }
            jest.spyOn(mockExportBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).post("/projects/1/backup/export")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("GET /projects/:project_id/samples/can_be_imported", () => {
        test("GET /projects/:project_id/samples/can_be_imported should return 200", async () => {
            const expectedResponse: PublicHeaderSampleResponseModel[] = []
            jest.spyOn(mockListImportableSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(expectedResponse))
            const response = await request(server).get("/projects/1/samples/can_be_imported")
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(200)
        });
        test("GET /projects/:project_id/samples/can_be_imported fail forUser cannot be used should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockListImportableSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).get("/projects/1/samples/can_be_imported")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("GET /projects/:project_id/samples/can_be_imported fail for Logged user cannot list importable samples in this project should return 401", async () => {
            const expectedResponse = { errors: ["Logged user cannot list importable samples in this project"] }
            jest.spyOn(mockListImportableSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Logged user cannot list importable samples in this project")))
            const response = await request(server).get("/projects/1/samples/can_be_imported")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("GET /projects/:project_id/samples/can_be_imported fail for Cannot find project should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find project"] }
            jest.spyOn(mockListImportableSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find project")))
            const response = await request(server).get("/projects/1/samples/can_be_imported")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        //Folder does not exist at path
        test("GET /projects/:project_id/samples/can_be_imported fail for Folder does not exist at path should return 404", async () => {
            const expectedResponse = { errors: ["Folder does not exist at path : /path/to/backup"] }
            jest.spyOn(mockListImportableSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Folder does not exist at path : /path/to/backup")))
            const response = await request(server).get("/projects/1/samples/can_be_imported")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // any other error
        test("GET /projects/:project_id/samples/can_be_imported fail for any other error should return 500", async () => {
            const expectedResponse = { errors: ["Cannot list importable samples"] }
            jest.spyOn(mockListImportableSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).get("/projects/1/samples/can_be_imported")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("POST /projects/:project_id/samples/import", () => {
        test("POST /projects/:project_id/samples/import should return 200", async () => {
            const expectedResponse = {
                success: true,
                task_import_samples: TaskResponseModel_1
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(200)
        });
        // User cannot be used 403
        test("POST /projects/:project_id/samples/import fail for User cannot be used and should return error 403", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["User cannot be used"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).post("/projects/1/samples/import").send({ backup_project: false })

            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Logged user cannot list importable samples in this project 401
        test("POST /projects/:project_id/samples/import fail for Logged user cannot list importable samples in this and should return error 401", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Logged user cannot list importable samples in this project"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Logged user cannot list importable samples in this project")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot find project 404
        test("POST /projects/:project_id/samples/import fail for Cannot find project and should return error 404", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Cannot find project"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find project")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task type not found 404
        test("POST /projects/:project_id/samples/import fail for Task type not found and should return error 404", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Task type not found"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task type not found")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task status not found 404
        test("POST /projects/:project_id/samples/import fail for Task status not found and should return error 404", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Task status not found"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task status not found")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot create log file 500
        test("POST /projects/:project_id/samples/import fail for Cannot create log file and should return error 500", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Cannot create log file"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot create log file")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task not found 404
        test("POST /projects/:project_id/samples/import fail for Task not found and should return error 404", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Task not found"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task not found")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Task is already in this status 500
        test("POST /projects/:project_id/samples/import fail for Task is already in this status and should return error 500", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Task is already in this status"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Task is already in this status")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot change status from 500
        test("POST /projects/:project_id/samples/import fail for Cannot change status from and should return error 500", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Cannot change status from"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot change status from")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot find task 404
        test("POST /projects/:project_id/samples/import fail for Cannot find task and should return error 404", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Cannot find task"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find task")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // An export backup is already running for this project 401
        test("POST /projects/:project_id/samples/import fail for An export backup is already running for this proje and should return error 401", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["An export backup is already running for this project"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("An export backup is already running for this project")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Folder does not exist at path 404
        test("POST /projects/:project_id/samples/import fail for Folder does not exist at path and should return error 404", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Folder does not exist at path"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Folder does not exist at path")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot import samples 500
        test("POST /projects/:project_id/samples/import fail for any other error and should return error 500", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Cannot import samples"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).post("/projects/1/samples/import")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /projects/:project_id/samples/import with req.body.backup_project === true should return 200", async () => {
            const expectedResponse = {
                success: true,
                task_import_samples: TaskResponseModel_1,
                task_backup_project: TaskResponseModel_2
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_2))
            const response = await request(server).post("/projects/1/samples/import").send({ backup_project: true })
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(200)
        });
        test("POST /projects/:project_id/samples/import with req.body.backup_project === true fail for any other error should return 500", async () => {
            const expectedResponse = {
                success: false,
                task_import_samples: TaskResponseModel_1,
                errors: {
                    backup: ["Cannot backup project"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).post("/projects/1/samples/import").send({ backup_project: true })
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /projects/:project_id/samples/import with req.body.backup_project === true, both fails with error 500", async () => {
            const expectedResponse = {
                success: false,
                errors: {
                    import: ["Cannot import samples"],
                    backup: ["Backup aborted"]
                }
            }
            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).post("/projects/1/samples/import").send({ backup_project: true })
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("GET /projects/:project_id/samples", () => {
        test("GET /projects/:project_id/samples should return 200", async () => {
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(SearchSampleResult))
            const response = await request(server).get("/projects/1/samples")
            expect(response.body).toStrictEqual(SearchSampleResult)
            expect(response.status).toBe(200)
        });
        // User cannot be used
        test("GET /projects/:project_id/samples fail for User cannot be used should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Missing field, operator, or value in filter
        test("GET /projects/:project_id/samples fail for Missing field, operator, or value in filter should return 403", async () => {
            const expectedResponse = { errors: ["Missing field, operator, or value in filter"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Missing field, operator, or value in filter")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Invalid sorting statement
        test("GET /projects/:project_id/samples fail for Invalid sorting statement should return 403", async () => {
            const expectedResponse = { errors: ["Invalid sorting statement"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Invalid sorting statement")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Sample type not found
        test("GET /projects/:project_id/samples fail for Sample type not found should return 403", async () => {
            const expectedResponse = { errors: ["Sample type not found"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Sample type not found")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Visual QC status not found
        test("GET /projects/:project_id/samples fail for Visual QC status not found should return 403", async () => {
            const expectedResponse = { errors: ["Visual QC status not found"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Visual QC status not found")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Unauthorized sort_by:
        test("GET /projects/:project_id/samples fail for Unauthorized sort_by: should return 403", async () => {
            const expectedResponse = { errors: ["Unauthorized sort_by:"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Unauthorized sort_by:")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Unauthorized order_by:
        test("GET /projects/:project_id/samples fail for Unauthorized order_by: should return 403", async () => {
            const expectedResponse = { errors: ["Unauthorized order_by:"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Unauthorized order_by:")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Unauthorized or unexisting parameters :
        test("GET /projects/:project_id/samples fail for Unauthorized or unexisting parameters : should return 403", async () => {
            const expectedResponse = { errors: ["Unauthorized or unexisting parameters :"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Unauthorized or unexisting parameters :")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot get samples
        test("GET /projects/:project_id/samples fail for Cannot get samples should return 403", async () => {
            const expectedResponse = { errors: ["Cannot get samples"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).get("/projects/1/samples")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("GET /projects/:project_id/samples/searches", () => {
        test("GET /projects/:project_id/samples/searches should return 200", async () => {
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(SearchSampleResult))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.body).toStrictEqual(SearchSampleResult)
            expect(response.status).toBe(200)
        });
        // User cannot be used
        test("GET /projects/:project_id/samples/searches fail for User cannot be used should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Missing field, operator, or value in filter
        test("GET /projects/:project_id/samples/searches fail for Missing field, operator, or value in filter should return 403", async () => {
            const expectedResponse = { errors: ["Missing field, operator, or value in filter"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Missing field, operator, or value in filter")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Invalid sorting statement
        test("GET /projects/:project_id/samples/searches fail for Invalid sorting statement should return 403", async () => {
            const expectedResponse = { errors: ["Invalid sorting statement"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Invalid sorting statement")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Sample type not found
        test("GET /projects/:project_id/samples/searches fail for Sample type not found should return 403", async () => {
            const expectedResponse = { errors: ["Sample type not found"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Sample type not found")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Visual QC status not found
        test("GET /projects/:project_id/samples/searches fail for Visual QC status not found should return 403", async () => {
            const expectedResponse = { errors: ["Visual QC status not found"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Visual QC status not found")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Unauthorized sort_by:
        test("GET /projects/:project_id/samples/searches fail for Unauthorized sort_by: should return 403", async () => {
            const expectedResponse = { errors: ["Unauthorized sort_by:"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Unauthorized sort_by:")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Unauthorized order_by:
        test("GET /projects/:project_id/samples/searches fail for Unauthorized order_by: should return 403", async () => {
            const expectedResponse = { errors: ["Unauthorized order_by:"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Unauthorized order_by:")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Unauthorized or unexisting parameters :
        test("GET /projects/:project_id/samples/searches fail for Unauthorized or unexisting parameters : should return 403", async () => {
            const expectedResponse = { errors: ["Unauthorized or unexisting parameters :"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Unauthorized or unexisting parameters :")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot search samples
        test("GET /projects/:project_id/samples/searches fail for Cannot search samples should return 403", async () => {
            const expectedResponse = { errors: ["Cannot search samples"] }
            jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).post("/projects/1/samples/searches")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
    describe("DELETE /projects/:project_id/samples/:sample_id", () => {
        test("DELETE /projects/:project_id/samples/:sample_id should return 200", async () => {
            jest.spyOn(mockDeleteSampleUseCase, "execute").mockImplementation(() => Promise.resolve())
            const response = await request(server).delete("/projects/1/samples/1")
            expect(response.status).toBe(200)
        });
        // User cannot be used
        test("DELETE /projects/:project_id/samples/:sample_id fail for User cannot be used should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockDeleteSampleUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).delete("/projects/1/samples/1")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot find sample to delete
        test("DELETE /projects/:project_id/samples/:sample_id fail for Cannot find sample to delete should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find sample to delete"] }
            jest.spyOn(mockDeleteSampleUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find sample to delete")))
            const response = await request(server).delete("/projects/1/samples/1")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // The given project_id does not match the sample's project_id
        test("DELETE /projects/:project_id/samples/:sample_id fail for The given project_id does not match the sample's project_id should return 403", async () => {
            const expectedResponse = { errors: ["The given project_id does not match the sample's project_id"] }
            jest.spyOn(mockDeleteSampleUseCase, "execute").mockImplementation(() => Promise.reject(new Error("The given project_id does not match the sample's project_id")))
            const response = await request(server).delete("/projects/1/samples/1")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Logged user cannot delete sample
        test("DELETE /projects/:project_id/samples/:sample_id fail for Logged user cannot delete sample should return 401", async () => {
            const expectedResponse = { errors: ["Logged user cannot delete sample"] }
            jest.spyOn(mockDeleteSampleUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Logged user cannot delete sample")))
            const response = await request(server).delete("/projects/1/samples/1")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        // Cannot delete sample
        test("DELETE /projects/:project_id/samples/:sample_id fail for Cannot delete sample should return 500", async () => {
            const expectedResponse = { errors: ["Cannot delete sample"] }
            jest.spyOn(mockDeleteSampleUseCase, "execute").mockImplementation(() => Promise.reject(new Error("xyz")))
            const response = await request(server).delete("/projects/1/samples/1")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    });
})
