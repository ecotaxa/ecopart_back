import express from "express";
import request from "supertest";
import { errorHandler, notFoundHandler } from "../../../src/presentation/middleware/error-handlers";

describe("JSON error handlers", () => {
    const app = express();
    app.use(express.json({ limit: "1kb" }));
    app.post("/echo", (req, res) => { res.status(200).send(req.body) });
    app.get("/boom", () => { throw new Error("secret internal detail") });
    app.use(notFoundHandler);
    app.use(errorHandler);

    beforeEach(() => {
        jest.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("a valid request is untouched", async () => {
        const response = await request(app).post("/echo").send({ a: 1 });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ a: 1 });
    });

    test("an unknown route answers 404 in JSON", async () => {
        const response = await request(app).get("/does-not-exist");
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ errors: ["Route not found"] });
    });

    test("a malformed JSON body answers 400 without a stack trace", async () => {
        const response = await request(app).post("/echo").set("Content-Type", "application/json").send('{"email": ');
        expect(response.status).toBe(400);
        expect(response.headers["content-type"]).toMatch(/application\/json/);
        expect(response.body).toEqual({ errors: ["Malformed JSON body"] });
    });

    test("a body over the limit keeps its 413 status", async () => {
        const response = await request(app).post("/echo").send({ data: "x".repeat(2048) });
        expect(response.status).toBe(413);
        expect(response.body).toEqual({ errors: ["request entity too large"] });
    });

    test("an uncaught error answers 500 without its message nor stack", async () => {
        const response = await request(app).get("/boom");
        expect(response.status).toBe(500);
        expect(response.body).toEqual({ errors: ["Internal server error"] });
        expect(JSON.stringify(response.body)).not.toContain("secret internal detail");
    });
});
