import request from "supertest";
import server from '../../../src/server'

import ProjectRouter from "../../../src/presentation/routers/project-router";

import { IMiddlewareSampleValidation } from "../../../src/presentation/interfaces/middleware/sample-validation";
import { MiddlewareSampleValidation } from "../../../src/presentation/middleware/sample-validation";

import { SearchSampleResult } from "../../entities/sample";
import { BackupProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/backup-project";
import { CreateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/create-project";
import { DeleteProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/delete-project";
import { ExportBackupedProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/export-backuped-project";
import { SearchProjectsUseCase } from "../../../src/domain/interfaces/use-cases/project/search-project";
import { UpdateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/update-project";
import { DeleteSampleUseCase } from "../../../src/domain/interfaces/use-cases/sample/delete-sample";
import { ImportSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/import-samples";
import { ListImportableSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/list-importable-samples";
import { SearchSamplesUseCase } from "../../../src/domain/interfaces/use-cases/sample/search-samples";
import { IMiddlewareProjectValidation } from "../../../src/presentation/interfaces/middleware/project-validation";
import { MockCreateProjectUseCase, MockDeleteProjectUseCase, MockUpdateProjectUseCase, MockSearchProjectsUseCase, MockBackupProjectUseCase, MockExportBackupedProjectUseCase, MockListImportableSamplesUseCase, MockImportSamplesUseCase, MockSearchSamplesUseCase, MockDeleteSampleUseCase } from "../../mocks/project-mock";
import { MiddlewareProjectValidation } from "../../../src/presentation/middleware/project-validation";
import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { Request, Response, NextFunction } from "express";

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

    test("Get samples all params are valid", async () => {
        const OutputData = SearchSampleResult
        const options = {
            page: 1,
            limit: 10,
            sort_by: "asc(sample_id)"
        }
        jest.spyOn(mockSearchSamplesUseCase, "execute").mockResolvedValue(OutputData)
        const response = await request(server).post("/projects/1/samples/searches").query(options)

        expect(mockSearchSamplesUseCase.execute).toBeCalledTimes(1)
        expect(response.status).toBe(200)
        expect(response.body).toStrictEqual(OutputData)
    });

    test("Get samples with invalid page", async () => {
        const options = {
            page: "a",
            limit: 10,
            sort_by: "asc(sample_id)"
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
        jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => { throw new Error() })
        const response = await request(server).post("/projects/1/samples/searches").query(options)

        expect(response.status).toBe(422)
        expect(response.body).toStrictEqual(OutputData)
        expect(mockSearchSamplesUseCase.execute).not.toBeCalled()
    });

    test("Get samples with invalid limit", async () => {
        const options = {
            page: 1,
            limit: "a",
            sort_by: "asc(sample_id)"
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
        jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => { throw new Error() })
        const response = await request(server).post("/projects/1/samples/searches").query(options)

        expect(response.status).toBe(422)
        expect(response.body).toStrictEqual(OutputData)
        expect(mockSearchSamplesUseCase.execute).not.toBeCalled()
    });

    test("get samples with default params", async () => {
        const OutputData = SearchSampleResult
        jest.spyOn(mockSearchSamplesUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
        const response = await request(server).post("/projects/1/samples/searches")

        expect(response.status).toBe(200)
        expect(response.body).toStrictEqual(OutputData)
        expect(mockSearchSamplesUseCase.execute).toBeCalledTimes(1)

    });
})

