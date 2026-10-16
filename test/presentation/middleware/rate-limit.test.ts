import express from "express";
import request from "supertest";
import { bodyEmail, limitAttempts } from "../../../src/presentation/middleware/rate-limit";

describe("limitAttempts", () => {
    let clock = 0;
    const app = express();
    app.use(express.json());
    app.post("/login", limitAttempts({ max: 3, window_ms: 60_000, key: bodyEmail, now: () => clock }), (_req, res) => { res.status(401).send({ errors: ["Invalid credentials"] }) });
    app.post("/other", limitAttempts({ max: 3, window_ms: 60_000, key: bodyEmail, now: () => clock }), (_req, res) => { res.status(200).send({}) });

    beforeEach(() => {
        clock += 10 * 60_000; // a fresh window for every test
    });

    const login = (email?: string) => request(app).post("/login").send(email === undefined ? {} : { email, password: "x" });

    test("lets the first attempts through, then answers 429 with Retry-After", async () => {
        for (let i = 0; i < 3; i++) expect((await login("a@example.org")).status).toBe(401);
        const blocked = await login("a@example.org");
        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual({ errors: ["Too many attempts, please try again later"] });
        expect(blocked.headers["retry-after"]).toBe("60");
    });

    test("counts the same e-mail whatever its case and spaces", async () => {
        await login("b@example.org");
        await login(" B@Example.org ");
        await login("b@EXAMPLE.ORG");
        expect((await login("b@example.org")).status).toBe(429);
    });

    test("counts each e-mail separately", async () => {
        for (let i = 0; i < 4; i++) await login("c@example.org");
        expect((await login("d@example.org")).status).toBe(401);
    });

    test("opens a new window once the previous one is over", async () => {
        for (let i = 0; i < 4; i++) await login("e@example.org");
        clock += 60_000;
        expect((await login("e@example.org")).status).toBe(401);
    });

    test("does not count a request without e-mail, left to the validation", async () => {
        for (let i = 0; i < 5; i++) expect((await login()).status).toBe(401);
    });

    test("keeps separate counters for separate routes", async () => {
        for (let i = 0; i < 4; i++) await login("f@example.org");
        expect((await request(app).post("/other").send({ email: "f@example.org" })).status).toBe(200);
    });
});
