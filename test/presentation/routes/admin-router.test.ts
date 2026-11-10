import request from "supertest";
import express from "express";
import { Request, Response, NextFunction } from "express";

import AdminRouter from "../../../src/presentation/routers/admin-router";
import { MiddlewareAdminValidation } from "../../../src/presentation/middleware/admin-validation";
import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";
import { ComputeParticleStatsUseCase } from "../../../src/domain/interfaces/use-cases/sample/compute-particle-stats";
import { MockComputeParticleStatsUseCase, MockGetStatsUseCase } from "../../mocks/stats-mock";
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
        server.use("/admin", AdminRouter(new MockMiddlewareAuth(), new MiddlewareAdminValidation(), new MockGetStatsUseCase(), computeParticleStatsUseCase));
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
            ["Task type not found", 404],
            ["Task status not found", 404],
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
