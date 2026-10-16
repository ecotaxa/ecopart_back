import express from "express";
import request from "supertest";
import VersionRouter from "../../../src/presentation/routers/version-router";
import { setServedApiVersion, swaggerSpec } from "../../../src/presentation/openapi/swagger-definition";

describe("GET /version", () => {
    test("returns the version the router was built with, without authentication", async () => {
        const app = express();
        app.use("/version", VersionRouter("v0.0.99"));

        const response = await request(app).get("/version");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ version: "v0.0.99" });
    });

    test("the served OpenAPI document shows the running version", () => {
        const previous = (swaggerSpec as { info: { version: string } }).info.version;
        try {
            setServedApiVersion("v0.0.99");
            expect((swaggerSpec as { info: { version: string } }).info.version).toBe("v0.0.99");
        } finally {
            setServedApiVersion(previous);
        }
    });
});
