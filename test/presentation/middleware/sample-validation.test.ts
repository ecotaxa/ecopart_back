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
import { MockCreateProjectUseCase, MockDeleteProjectUseCase, MockUpdateProjectUseCase, MockSearchProjectsUseCase, MockBackupProjectUseCase, MockExportBackupedProjectUseCase, MockListImportableSamplesUseCase, MockImportSamplesUseCase, MockSearchSamplesUseCase, MockDeleteSampleUseCase, MockListImportableEcoTaxaSamplesUseCase, MockImportEcoTaxaSamplesUseCase, MockDeleteEcoTaxaSamplesUseCase, MockSearchEcoTaxaSamplesUseCase, MockListShipsUseCase } from "../../mocks/project-mock";
import { MiddlewareProjectValidation } from "../../../src/presentation/middleware/project-validation";
import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { Request, Response, NextFunction } from "express";
import { ListImportableEcoTaxaSamplesUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_sample/list-importable-ecotaxa-samples";
import { ImportEcoTaxaSamplesUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_sample/import-ecotaxa-samples";
import { DeleteEcoTaxaSamplesUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_sample/delete-ecotaxa-samples";
import { SearchEcoTaxaSamplesUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_sample/search-ecotaxa-samples";
import { ListShipsUseCase } from "../../../src/domain/interfaces/use-cases/project/list-ships";
import { SelectSampleCoordinatesUseCase } from "../../../src/domain/interfaces/use-cases/sample/select-sample-coordinates";
import { sampleModel_1 } from "../../entities/sample";
import { RegeneratePivotsUseCase } from "../../../src/domain/interfaces/use-cases/sample/regenerate-pivots";
import { TaskResponseModel_1 } from "../../entities/task";
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
    let mockListImportableEcoTaxaSamplesUseCase: ListImportableEcoTaxaSamplesUseCase;
    let mockImportEcoTaxaSamplesUseCase: ImportEcoTaxaSamplesUseCase;
    let mockDeleteEcoTaxaSamplesUseCase: DeleteEcoTaxaSamplesUseCase;
    let mockSearchEcoTaxaSamplesUseCase: SearchEcoTaxaSamplesUseCase;
    let mockListShipsUseCase: ListShipsUseCase;
    const mockSelectSampleCoordinatesUseCase: SelectSampleCoordinatesUseCase = {
        execute(): Promise<any> { throw new Error("Method not implemented for SelectSampleCoordinatesUseCase") }
    };
    const mockRegeneratePivotsUseCase: RegeneratePivotsUseCase = {
        execute(): Promise<any> { throw new Error("Method not implemented for RegeneratePivotsUseCase") }
    };

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

        mockListImportableEcoTaxaSamplesUseCase = new MockListImportableEcoTaxaSamplesUseCase()
        mockImportEcoTaxaSamplesUseCase = new MockImportEcoTaxaSamplesUseCase()
        mockDeleteEcoTaxaSamplesUseCase = new MockDeleteEcoTaxaSamplesUseCase()
        mockSearchEcoTaxaSamplesUseCase = new MockSearchEcoTaxaSamplesUseCase()
        mockListShipsUseCase = new MockListShipsUseCase()

        server.use("/projects", ProjectRouter(mockMiddlewareAuth, middlewareProjectValidation, middlewareSampleValidation, mockCreateProjectUseCase, mockDeleteProjectUseCase, mockUpdateProjectUseCase, mockSearchProjectsUseCase, {} as any, mockBackupProjectUseCase, mockExportBackupProjectUseCase, mockListImportableSamplesUseCase, mockImportSamplesUseCase, mockDeleteSampleUseCase, mockSearchSamplesUseCase, mockListImportableEcoTaxaSamplesUseCase, mockImportEcoTaxaSamplesUseCase, mockDeleteEcoTaxaSamplesUseCase, mockSearchEcoTaxaSamplesUseCase, {} as any, {} as any, {} as any, {} as any, mockListShipsUseCase, {} as any, {} as any, {} as any, {} as any, mockSelectSampleCoordinatesUseCase, {} as any, mockRegeneratePivotsUseCase))
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

    describe("PATCH /projects/:project_id/samples/:sample_id/coordinates", () => {
        test("passes a boolean selection to the use case", async () => {
            const updated = { ...sampleModel_1, use_ctd_coordinates: true };
            jest.spyOn(mockSelectSampleCoordinatesUseCase, "execute").mockResolvedValue(updated);

            const response = await request(server).patch("/projects/1/samples/1/coordinates").send({ use_ctd_coordinates: true });

            expect(response.status).toBe(200);
            expect(response.body.use_ctd_coordinates).toBe(true);
            expect(mockSelectSampleCoordinatesUseCase.execute).toBeCalledWith(undefined, 1, 1, true);
        });

        test("rejects a missing use_ctd_coordinates", async () => {
            const spy = jest.spyOn(mockSelectSampleCoordinatesUseCase, "execute");

            const response = await request(server).patch("/projects/1/samples/1/coordinates").send({});

            expect(response.status).toBe(422);
            expect(spy).not.toBeCalled();
        });

        test("rejects a non-boolean use_ctd_coordinates", async () => {
            const spy = jest.spyOn(mockSelectSampleCoordinatesUseCase, "execute");

            const response = await request(server).patch("/projects/1/samples/1/coordinates").send({ use_ctd_coordinates: "yes" });

            expect(response.status).toBe(422);
            expect(spy).not.toBeCalled();
        });

        test("maps a sample without CTD coordinates to 422", async () => {
            jest.spyOn(mockSelectSampleCoordinatesUseCase, "execute").mockRejectedValue(new Error("Sample has no CTD coordinates"));

            const response = await request(server).patch("/projects/1/samples/1/coordinates").send({ use_ctd_coordinates: true });

            expect(response.status).toBe(422);
            expect(response.body).toStrictEqual({ errors: ["Sample has no CTD coordinates"] });
        });
    });

    describe("POST /projects/:project_id/samples/pivots/regenerate", () => {
        test("starts the task with the requested samples and force flag", async () => {
            jest.spyOn(mockRegeneratePivotsUseCase, "execute").mockResolvedValue(TaskResponseModel_1);

            const response = await request(server).post("/projects/1/samples/pivots/regenerate").send({ sample_names: ["perle3_001"], force: true });

            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual(TaskResponseModel_1);
            expect(mockRegeneratePivotsUseCase.execute).toBeCalledWith(undefined, 1, { sample_names: ["perle3_001"], force: true });
        });

        test("accepts an empty body: every sample, not forced", async () => {
            jest.spyOn(mockRegeneratePivotsUseCase, "execute").mockResolvedValue(TaskResponseModel_1);

            const response = await request(server).post("/projects/1/samples/pivots/regenerate");

            expect(response.status).toBe(200);
            expect(mockRegeneratePivotsUseCase.execute).toBeCalledWith(undefined, 1, { sample_names: undefined, force: undefined });
        });

        test("rejects a non-boolean force and a non-array sample_names", async () => {
            const spy = jest.spyOn(mockRegeneratePivotsUseCase, "execute");

            const bad_force = await request(server).post("/projects/1/samples/pivots/regenerate").send({ force: "yes" });
            const bad_names = await request(server).post("/projects/1/samples/pivots/regenerate").send({ sample_names: "perle3_001" });

            expect(bad_force.status).toBe(422);
            expect(bad_names.status).toBe(422);
            expect(spy).not.toBeCalled();
        });

        test.each([
            ["Logged user cannot regenerate pivots in this project", 401],
            ["Cannot find project", 404],
            ["Samples not found in this project: ghost", 404],
            ["Pivots only exist for UVP5 projects", 422],
        ])("maps \"%s\" to %i", async (message, status) => {
            jest.spyOn(mockRegeneratePivotsUseCase, "execute").mockRejectedValue(new Error(message));

            const response = await request(server).post("/projects/1/samples/pivots/regenerate").send({});

            expect(response.status).toBe(status);
            expect(response.body).toStrictEqual({ errors: [message] });
        });
    });
})
