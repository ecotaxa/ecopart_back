import request from "supertest";
import express from "express";
import { Request, Response, NextFunction } from "express";

import AdminRouter from "../../../src/presentation/routers/admin-router";
import { MiddlewareAdminValidation } from "../../../src/presentation/middleware/admin-validation";
import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";
import { ComputeParticleStatsUseCase } from "../../../src/domain/interfaces/use-cases/sample/compute-particle-stats";
import { RegenerateAllPivotsUseCase } from "../../../src/domain/interfaces/use-cases/sample/regenerate-all-pivots";
import { MockComputeParticleStatsUseCase, MockGetStatsUseCase, MockRegenerateAllPivotsUseCase } from "../../mocks/stats-mock";
import { TaskResponseModel_1, toPublicTask } from "../../entities/task";

class MockMiddlewareAuth implements MiddlewareAuth {
    auth(req: Request, __: Response, next: NextFunction): void {
        (req as CustomRequest).token = ({ user_id: 1, is_admin: true } as DecodedToken);
        next();
    }
    auth_optional(_: Request, __: Response, next: NextFunction): void {
        next();
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh");
    }
}

describe("AdminRouter — POST /admin/samples/particle-stats", () => {
    let server: express.Express;
    let computeParticleStatsUseCase: ComputeParticleStatsUseCase;
    const public_task = toPublicTask(TaskResponseModel_1);

    beforeAll(() => {
        // A local app rather than the shared src/server, so these routes cannot leak into
        // (or be affected by) the other router test suites.
        server = express();
        server.use(express.json());
        computeParticleStatsUseCase = new MockComputeParticleStatsUseCase();
        server.use("/admin", AdminRouter(new MockMiddlewareAuth(), new MiddlewareAdminValidation(), new MockGetStatsUseCase(), computeParticleStatsUseCase, new MockRegenerateAllPivotsUseCase()));
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("success", () => {
        test("returns 200 with the created task and forwards the options", async () => {
            jest.spyOn(computeParticleStatsUseCase, "execute").mockResolvedValue(public_task);

            const response = await request(server).post("/admin/samples/particle-stats").send({ project_ids: [12, 14], force: true });

            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual(JSON.parse(JSON.stringify(public_task)));
            expect(computeParticleStatsUseCase.execute).toBeCalledTimes(1);
            expect(computeParticleStatsUseCase.execute).toBeCalledWith(expect.objectContaining({ user_id: 1 }), { project_ids: [12, 14], force: true });
        });

        test("every option is optional", async () => {
            jest.spyOn(computeParticleStatsUseCase, "execute").mockResolvedValue(public_task);

            const response = await request(server).post("/admin/samples/particle-stats").send();

            expect(response.status).toBe(200);
            expect(computeParticleStatsUseCase.execute).toBeCalledWith(expect.objectContaining({ user_id: 1 }), { project_ids: undefined, force: undefined });
        });
    });

    describe("domain errors are mapped to status codes", () => {
        // The router matches on the use case's error messages, so these must stay in sync with
        // the messages thrown in compute-particle-stats.ts and the task repository.
        const cases: Array<[string, number]> = [
            ["User cannot be used", 403],
            ["Logged user cannot compute particle stats", 403],
            ["Task type not found", 500],
            ["Task status not found", 500],
            ["Cannot find task", 404],
            ["Task not found", 404],
            ["Cannot create log file", 500],
        ];

        test.each(cases)("'%s' → %i", async (message, status) => {
            jest.spyOn(computeParticleStatsUseCase, "execute").mockRejectedValue(new Error(message));

            const response = await request(server).post("/admin/samples/particle-stats").send({});

            expect(response.status).toBe(status);
            expect(response.body).toStrictEqual({ errors: [message] });
        });

        test("an unexpected error is masked behind a generic 500", async () => {
            jest.spyOn(computeParticleStatsUseCase, "execute").mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));

            const response = await request(server).post("/admin/samples/particle-stats").send({});

            expect(response.status).toBe(500);
            expect(response.body).toStrictEqual({ errors: ["Cannot compute particle stats"] });
        });
    });
});

describe("AdminRouter — POST /admin/samples/pivots/regenerate", () => {
    let server: express.Express;
    let regenerateAllPivotsUseCase: RegenerateAllPivotsUseCase;
    const public_task = toPublicTask(TaskResponseModel_1);

    beforeAll(() => {
        server = express();
        server.use(express.json());
        regenerateAllPivotsUseCase = new MockRegenerateAllPivotsUseCase();
        server.use("/admin", AdminRouter(new MockMiddlewareAuth(), new MiddlewareAdminValidation(), new MockGetStatsUseCase(), new MockComputeParticleStatsUseCase(), regenerateAllPivotsUseCase));
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns 200 with the created task and forwards the options", async () => {
        jest.spyOn(regenerateAllPivotsUseCase, "execute").mockResolvedValue(public_task);

        const response = await request(server).post("/admin/samples/pivots/regenerate").send({ project_ids: [12], force: true });

        expect(response.status).toBe(200);
        expect(response.body).toStrictEqual(JSON.parse(JSON.stringify(public_task)));
        expect(regenerateAllPivotsUseCase.execute).toBeCalledWith(expect.objectContaining({ user_id: 1 }), { project_ids: [12], force: true });
    });

    test("every option is optional", async () => {
        jest.spyOn(regenerateAllPivotsUseCase, "execute").mockResolvedValue(public_task);

        const response = await request(server).post("/admin/samples/pivots/regenerate").send();

        expect(response.status).toBe(200);
        expect(regenerateAllPivotsUseCase.execute).toBeCalledWith(expect.objectContaining({ user_id: 1 }), { project_ids: undefined, force: undefined });
    });

    test("rejects a non-boolean force with 422", async () => {
        jest.spyOn(regenerateAllPivotsUseCase, "execute");

        const response = await request(server).post("/admin/samples/pivots/regenerate").send({ force: "yes" });

        expect(response.status).toBe(422);
        expect(regenerateAllPivotsUseCase.execute).toBeCalledTimes(0);
    });

    // Must stay in sync with the messages thrown in regenerate-all-pivots.ts and the task repository.
    const cases: Array<[string, number]> = [
        ["User cannot be used", 403],
        ["Logged user cannot regenerate pivots", 403],
        ["Task type not found", 500],
        ["Task status not found", 500],
        ["Cannot find task", 404],
        ["Task not found", 404],
        ["Cannot create log file", 500],
    ];

    test.each(cases)("'%s' → %i", async (message, status) => {
        jest.spyOn(regenerateAllPivotsUseCase, "execute").mockRejectedValue(new Error(message));

        const response = await request(server).post("/admin/samples/pivots/regenerate").send({});

        expect(response.status).toBe(status);
        expect(response.body).toStrictEqual({ errors: [message] });
    });

    test("an unexpected error is masked behind a generic 500", async () => {
        jest.spyOn(regenerateAllPivotsUseCase, "execute").mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));

        const response = await request(server).post("/admin/samples/pivots/regenerate").send({});

        expect(response.status).toBe(500);
        expect(response.body).toStrictEqual({ errors: ["Cannot regenerate pivots"] });
    });
});
