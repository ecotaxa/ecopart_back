import request from "supertest";
import express, { Request, Response } from "express";

import { MiddlewareAdminValidation } from "../../../src/presentation/middleware/admin-validation";

describe("MiddlewareAdminValidation — rulesComputeParticleStats", () => {
    let server: express.Express;
    let received: jest.Mock;

    beforeAll(() => {
        // The chain alone, in front of a handler that answers with the body it received.
        server = express();
        server.use(express.json());
        received = jest.fn();
        server.post("/particle-stats", new MiddlewareAdminValidation().rulesComputeParticleStats, (req: Request, res: Response) => {
            received(req.body);
            res.status(200).send(req.body);
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const post = (body?: object) => request(server).post("/particle-stats").send(body);
    const messages = (response: request.Response) => response.body.errors.map((error: { msg: string }) => error.msg);

    describe("accepts", () => {
        test("an empty body", async () => {
            const response = await post();
            expect(response.status).toBe(200);
            expect(received).toBeCalledTimes(1);
        });

        test("project ids, converted to numbers, and force", async () => {
            const response = await post({ project_ids: [12, "14"], force: true });
            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual({ project_ids: [12, 14], force: true });
        });

        test("an empty project list (every project) and force false", async () => {
            const response = await post({ project_ids: [], force: false });
            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual({ project_ids: [], force: false });
        });
    });

    describe("refuses with a 422", () => {
        const cases: Array<[string, object, string]> = [
            ["project_ids that is not an array", { project_ids: 12 }, "project_ids must be an array."],
            ["a project id of 0", { project_ids: [0] }, "project_ids must contain positive integers."],
            ["a negative project id", { project_ids: [-3] }, "project_ids must contain positive integers."],
            ["a decimal project id", { project_ids: [1.5] }, "project_ids must contain positive integers."],
            ["a project id that is not a number", { project_ids: ["abc"] }, "project_ids must contain positive integers."],
            ["force that is not a boolean", { force: "yes" }, "force must be a boolean."],
            ["force given as a number", { force: 1 }, "force must be a boolean."],
            ["force given as a string", { force: "true" }, "force must be a boolean."],
        ];

        test.each(cases)("%s", async (_name, body, message) => {
            const response = await post(body);
            expect(response.status).toBe(422);
            expect(messages(response)).toContain(message);
            expect(received).toBeCalledTimes(0);
        });
    });
});
