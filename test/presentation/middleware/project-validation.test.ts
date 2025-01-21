//TODO
import request from "supertest";
import server from '../../../src/server'

import ProjectRouter from '../../../src/presentation/routers/project-router'

import { PublicProjectResponseModel, PublicProjectRequestCreationModel } from "../../../src/domain/entities/project";

import { CreateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/create-project";
import { UpdateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/update-project";
import { DeleteProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/delete-project";
import { SearchProjectsUseCase } from "../../../src/domain/interfaces/use-cases/project/search-project";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { IMiddlewareProjectValidation } from "../../../src/presentation/interfaces/middleware/project-validation";
import { IMiddlewareSampleValidation } from "../../../src/presentation/interfaces/middleware/sample-validation";
import { MiddlewareProjectValidation } from "../../../src/presentation/middleware/project-validation";
import { MiddlewareSampleValidation } from "../../../src/presentation/middleware/sample-validation";

import { Request, Response, NextFunction } from "express";
import { SearchInfo } from "../../../src/domain/entities/search";
import { partial_projectUpdateModel_toSanatize, projectRequestCreationModel, projectRequestCreationModel_withDataSanitized, projectRequestCreationModel_withDataToSanitize, projectRequestCreationModel_withmissingData, projectResponseModel, partial_projectUpdateModel, projectRequestCreationModel_withmissingData_2, partial_projectUpdateModel_withInvalidData } from "../../entities/project";
import { BackupProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/backup-project";
import { ExportBackupedProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/export-backuped-project";
import { DeleteSampleUseCase } from "../../../src/domain/interfaces/use-cases/sample/delete-sample";
import { ImportSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/import-samples";
import { ListImportableSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/list-importable-samples";
import { SearchSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/search-samples";
import { MockBackupProjectUseCase, MockCreateProjectUseCase, MockDeleteProjectUseCase, MockDeleteSampleUseCase, MockExportBackupedProjectUseCase, MockImportSamplesUseCase, MockListImportableSamplesUseCase, MockSearchProjectsUseCase, MockSearchSamplesUseCase, MockUpdateProjectUseCase } from "../../mocks/project-mock";
import { TaskResponseModel } from "../../../src/domain/entities/task";
import { TaskResponseModel_1, TaskResponseModel_2 } from "../../entities/task";
export class MockMiddlewareAuth implements MiddlewareAuth {
    auth(_: Request, __: Response, next: NextFunction): void {
        next()
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh")
    }
}

describe("Project Router", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let middlewareProjectValidation: IMiddlewareProjectValidation;
    let middlewareSampleValidation: IMiddlewareSampleValidation;
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
        middlewareProjectValidation = new MiddlewareProjectValidation()
        middlewareSampleValidation = new MiddlewareSampleValidation()
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

    describe("Test project router create project validation", () => {
        test("Create project all params are valid", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel

            const OutputData: PublicProjectResponseModel = projectResponseModel
            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Sanitize email and organisation", async () => {
            //TODO affine test on sanitized data
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel_withDataToSanitize
            const sanitizedInputData: PublicProjectRequestCreationModel = projectRequestCreationModel_withDataSanitized

            const OutputData: PublicProjectResponseModel = projectResponseModel

            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateProjectUseCase.execute).toBeCalledWith(undefined, sanitizedInputData)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });


        test("Missing project_title and data_owner_name", async () => {
            const InputData = projectRequestCreationModel_withmissingData
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
                    },
                    {
                        "location": "body",
                        "msg": "Contact user_id is required.",
                        "path": "contact",
                        "type": "field",
                        "value": {},
                    },
                    {
                        "location": "body",
                        "msg": "Members are required.",
                        "path": "members",
                        "type": "field",
                    },
                    {
                        "location": "body",
                        "msg": "Members must be an array.",
                        "path": "members",
                        "type": "field",
                    },
                    {
                        "location": "body",
                        "msg": "At least one user must be a manager",
                        "path": "managers",
                        "type": "field",
                        "value": [],
                    }

                ]
            }
            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(422)
            expect(mockCreateProjectUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Missing Member user_id.", async () => {
            const InputData = projectRequestCreationModel_withmissingData_2
            const OutputData = {
                "errors": [
                    {
                        "location": "body",
                        "msg": "Member user_id is required.",
                        "path": "members",
                        "type": "field",
                        "value": [{}],
                    },
                    {
                        "location": "body",
                        "msg": "Manager user_id is required.",
                        "path": "managers",
                        "type": "field",
                        "value": [{}],
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
            const project_to_update = partial_projectUpdateModel
            const OutputData: PublicProjectResponseModel = projectResponseModel

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).patch("/projects/1").send(project_to_update)

            expect(response.body).toStrictEqual(OutputData)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(mockUpdateProjectUseCase.execute).toBeCalledWith(undefined, { ...project_to_update, project_id: "1" })
            expect(response.status).toBe(200)
        });

        test("Sanitize last_name and first_name", async () => {
            const project_to_update = partial_projectUpdateModel_toSanatize
            const sanitizedInputData = partial_projectUpdateModel

            const OutputData: PublicProjectResponseModel = projectResponseModel

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).patch("/projects/1").send(project_to_update)
            expect(response.status).toBe(200)
            expect(mockUpdateProjectUseCase.execute).toBeCalledWith(undefined, { ...sanitizedInputData, project_id: "1" })
            expect(response.body).toStrictEqual(OutputData)
        });

        test("update project with invalid instrument", async () => {
            const project_to_update = partial_projectUpdateModel_withInvalidData
            const OutputData = {
                "errors": [
                    {
                        "location": "body",
                        "msg": "Instrument model must be a string included in the following list of instrument models: ['UVP5HD', 'UVP5SD', 'UVP5Z', 'UVP6LP', 'UVP6HF', 'UVP6MHP', 'UVP6MHF']",
                        "path": "instrument_model",
                        "type": "field",
                        "value": "invalid_param"
                    }
                ]
            }
            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).patch("/projects/1").send(project_to_update)

            expect(response.status).toBe(422)
            expect(mockUpdateProjectUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
        });
    })

    describe("Test project router rules GetProjects", () => {
        test("Get projects all params are valid", async () => {
            const OutputData: { projects: PublicProjectResponseModel[], search_info: SearchInfo } = {
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
            const OutputData: { projects: PublicProjectResponseModel[], search_info: SearchInfo } = {
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
    describe("Test project rulesProjectBackup", () => {
        test("Backup project all params are valid", async () => {
            const InputData = {
                skip_already_imported: true
            }

            const OutputData: TaskResponseModel = TaskResponseModel_2
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).post("/projects/1/backup").send(InputData)

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockBackupProjectUseCase.execute).toBeCalledTimes(1)
        });

        test("Backup project with invalid skip_already_imported", async () => {
            const InputData = {
                skip_already_imported: "a"
            }

            const OutputData = {
                "errors": [
                    {
                        "location": "body",
                        "msg": "Skip already imported must be a boolean true or false value.",
                        "path": "skip_already_imported",
                        "type": "field",
                        "value": "a"
                    }
                ]
            }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).post("/projects/1/backup").send(InputData)

            expect(mockBackupProjectUseCase.execute).not.toBeCalled()
            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
        });
    });
    describe("Test project rulesProjectBackup", () => {
        test("Backup project all params are valid", async () => {
            const InputData = {
                backup_project: true,
                backup_project_skip_already_imported: true,
                samples: ["Mooring_0N_23W_201910_850m"]
            }
            const OutputData = {
                success: true,
                task_import_samples: TaskResponseModel_1,
                task_backup_project: TaskResponseModel_2
            }

            jest.spyOn(mockImportSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_2))
            const response = await request(server).post("/projects/1/samples/import").send(InputData)

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockBackupProjectUseCase.execute).toBeCalledTimes(1)
        });

        test("Backup project with invalid params", async () => {
            const InputData = {
                backup_project: "fegrg",
                backup_project_skip_already_imported: 100,
                samples: "Mooring_0N_23W_201910_850m"
            }
            const OutputData = {
                "errors": [
                    {
                        type: "field",
                        value: "fegrg",
                        msg: "Backup project must be a boolean true or false value.",
                        path: "backup_project",
                        location: "body",
                    },
                    {
                        type: "field",
                        value: 100,
                        msg: "Backup project, skip already imported must be a boolean true or false value.",
                        path: "backup_project_skip_already_imported",
                        location: "body",
                    },
                    {
                        type: "field",
                        value: "Mooring_0N_23W_201910_850m",
                        msg: "Samples must be an array.",
                        path: "samples",
                        location: "body",
                    },
                ]
            }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).post("/projects/1/samples/import").send(InputData)

            expect(mockBackupProjectUseCase.execute).not.toBeCalled()
            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
        });
        test("Backup project with missing params", async () => {
            const InputData = {
            }
            const OutputData = {
                "errors": [
                    {
                        type: "field",
                        msg: "Samples are required.",
                        path: "samples",
                        location: "body",
                    },
                    {
                        type: "field",
                        msg: "Samples must be an array.",
                        path: "samples",
                        location: "body",
                    },
                ]
            }
            jest.spyOn(mockBackupProjectUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).post("/projects/1/samples/import").send(InputData)

            expect(mockBackupProjectUseCase.execute).not.toBeCalled()
            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
        });
    });
})
