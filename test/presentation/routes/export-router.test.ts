import request from "supertest";
import express from "express";
import { Request, Response, NextFunction } from "express";

import ExportRouter from "../../../src/presentation/routers/export-router";
// Note: unlike the other middlewares, this interface is declared in the middleware file itself
// rather than under presentation/interfaces/middleware/.
import { MiddlewareExportValidation, IMiddlewareExportValidation } from "../../../src/presentation/middleware/export-validation";
import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";

import { ExportRawDataUseCase } from "../../../src/domain/interfaces/use-cases/export/export-raw-data";
import { TaskResponseModel } from "../../../src/domain/entities/task";
import { TaskResponseModel_1 } from "../../entities/task";

class MockMiddlewareAuth implements MiddlewareAuth {
    auth(req: Request, __: Response, next: NextFunction): void {
        (req as CustomRequest).token = ({ user_id: 1, is_admin: false } as DecodedToken);
        next();
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh");
    }
}

class MockExportRawDataUseCase implements ExportRawDataUseCase {
    execute(): Promise<TaskResponseModel> {
        throw new Error("Method not implemented for execute");
    }
}

// The real validation middleware is used on purpose: the 422 contract of this route is
// entirely express-validator's, so mocking it away would test nothing.
const validation: IMiddlewareExportValidation = new MiddlewareExportValidation();

describe("ExportRouter — POST /exports/raw", () => {
    let server: express.Express;
    let exportRawDataUseCase: ExportRawDataUseCase;

    const valid_body = { sample_ids: [1, 2], export_types: ["metadata"] };

    beforeAll(() => {
        // A local app rather than the shared src/server, so these routes cannot leak into
        // (or be affected by) the other router test suites.
        server = express();
        server.use(express.json());
        exportRawDataUseCase = new MockExportRawDataUseCase();
        server.use("/exports", ExportRouter(new MockMiddlewareAuth(), validation, exportRawDataUseCase));
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("success", () => {
        test("returns 200 with the created task and forwards the request as-is", async () => {
            jest.spyOn(exportRawDataUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1));

            const response = await request(server)
                .post("/exports/raw")
                .send({ sample_ids: [7, 9], export_types: ["metadata", "ecotaxa"], ecotaxa_exclude_not_living: true });

            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual(JSON.parse(JSON.stringify(TaskResponseModel_1)));
            expect(exportRawDataUseCase.execute).toBeCalledTimes(1);
            expect(exportRawDataUseCase.execute).toBeCalledWith(
                expect.objectContaining({ user_id: 1 }),
                { sample_ids: [7, 9], export_types: ["metadata", "ecotaxa"], ecotaxa_exclude_not_living: true },
            );
        });
    });

    describe("domain errors are mapped to status codes", () => {
        // The router matches on the use case's error messages, so these must stay in sync with
        // the messages thrown in export-raw-data.ts.
        const cases: Array<[string, number]> = [
            ["User cannot be used", 403],
            ["Logged user cannot export raw data from project 3", 401],
            ["No samples found", 404],
            ["Sample(s) not found: 42", 404],
            ["Cannot find project", 404],
            ["Cannot find task", 404],
            ["Task type not found", 404],
            ["Sample(s) not validated: omer2_1, omer2_2", 409],
            ["Cannot create log file", 500],
        ];

        test.each(cases)("'%s' → %i", async (message, status) => {
            jest.spyOn(exportRawDataUseCase, "execute").mockImplementation(() => { throw new Error(message) });

            const response = await request(server).post("/exports/raw").send(valid_body);

            expect(response.status).toBe(status);
            expect(response.body).toStrictEqual({ errors: [message] });
        });

        test("an unexpected error is masked behind a generic 500", async () => {
            jest.spyOn(exportRawDataUseCase, "execute").mockImplementation(() => { throw new Error("SQLITE_BUSY: database is locked") });

            const response = await request(server).post("/exports/raw").send(valid_body);

            expect(response.status).toBe(500);
            expect(response.body).toStrictEqual({ errors: ["Cannot export raw data"] });
        });
    });

    describe("request validation (422, use case never called)", () => {
        const invalid_bodies: Array<[string, Record<string, unknown>]> = [
            ["sample_ids missing", { export_types: ["metadata"] }],
            ["sample_ids empty", { sample_ids: [], export_types: ["metadata"] }],
            ["sample_ids not an array", { sample_ids: 1, export_types: ["metadata"] }],
            ["sample_ids not integers", { sample_ids: ["abc"], export_types: ["metadata"] }],
            ["sample_ids zero or negative", { sample_ids: [0, -3], export_types: ["metadata"] }],
            ["export_types missing", { sample_ids: [1] }],
            ["export_types empty", { sample_ids: [1], export_types: [] }],
            ["export_types unknown value", { sample_ids: [1], export_types: ["vignettes"] }],
            ["ecotaxa selected without ecotaxa_exclude_not_living", { sample_ids: [1], export_types: ["ecotaxa"] }],
            ["ecotaxa_exclude_not_living not a boolean", { sample_ids: [1], export_types: ["ecotaxa"], ecotaxa_exclude_not_living: "yes please" }],
        ];

        test.each(invalid_bodies)("%s", async (_label, body) => {
            jest.spyOn(exportRawDataUseCase, "execute");

            const response = await request(server).post("/exports/raw").send(body);

            expect(response.status).toBe(422);
            expect(response.body.errors.length).toBeGreaterThan(0);
            expect(exportRawDataUseCase.execute).toBeCalledTimes(0);
        });

        test("ecotaxa_exclude_not_living is optional when ecotaxa is not requested", async () => {
            jest.spyOn(exportRawDataUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1));

            const response = await request(server)
                .post("/exports/raw")
                .send({ sample_ids: [1], export_types: ["lpm", "ctd"] });

            expect(response.status).toBe(200);
            expect(exportRawDataUseCase.execute).toBeCalledTimes(1);
        });

        test("skip_not_validated is optional but must be a boolean, and is forwarded", async () => {
            jest.spyOn(exportRawDataUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1));

            const ok = await request(server)
                .post("/exports/raw")
                .send({ sample_ids: [1], export_types: ["metadata"], skip_not_validated: true });
            expect(ok.status).toBe(200);
            expect(exportRawDataUseCase.execute).toBeCalledWith(expect.anything(),
                expect.objectContaining({ skip_not_validated: true }));

            const bad = await request(server)
                .post("/exports/raw")
                .send({ sample_ids: [1], export_types: ["metadata"], skip_not_validated: "oui" });
            expect(bad.status).toBe(422);
            expect(exportRawDataUseCase.execute).toBeCalledTimes(1);
        });

        test("every export type of the enum is accepted", async () => {
            jest.spyOn(exportRawDataUseCase, "execute").mockImplementation(() => Promise.resolve(TaskResponseModel_1));

            const response = await request(server)
                .post("/exports/raw")
                .send({
                    sample_ids: [1],
                    export_types: ["metadata", "lpm", "images", "instrument_config", "ctd", "ecotaxa"],
                    ecotaxa_exclude_not_living: false,
                });

            expect(response.status).toBe(200);
            expect(exportRawDataUseCase.execute).toBeCalledTimes(1);
        });
    });
});
