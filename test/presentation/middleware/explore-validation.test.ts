import express, { Request, Response } from "express";
import request from "supertest";
import { MiddlewareExploreValidation, parseExploreFilters } from "../../../src/presentation/middleware/explore-validation";

const DEFAULTS = {
    project_ids: [],
    instrument_models: [],
    bounds: null,
    date_from: null,
    date_to: null,
    months: [],
    sample_names: [],
    hour_range: null,
    pressure_range: null,
    privacy_statuses: [],
    my_projects: false,
    ctd_only: false,
    ecotaxa_imported_only: false,
    ecotaxa_exclude_not_living: false,
    classification_state: "all",
};

describe("parseExploreFilters", () => {
    test("no filters: null", () => {
        expect(parseExploreFilters(null)).toBeNull();
        expect(parseExploreFilters(undefined)).toBeNull();
    });

    test("an empty object: no constraint", () => {
        expect(parseExploreFilters({})).toEqual(DEFAULTS);
    });

    test("a full selection, as the front sends it", () => {
        expect(parseExploreFilters({
            project_ids: [3, "12"],
            instrument_models: ["UVP6LP", "UVP5HD"],
            bounds: { north: 45, south: "40.5", east: 10, west: 3 },
            date_from: "2024-01-01",
            date_to: "2024-12-31",
            months: [6, "7"],
            sample_names: ["moose_ge", "tara_"],
            hour_range: [6, 18.5],
            pressure_range: [0, 1000],
            privacy_statuses: ["public", "open"],
            my_projects: true,
            ctd_only: "true",
            ecotaxa_imported_only: false,
            ecotaxa_exclude_not_living: "false",
            classification_state: "fully_validated",
        })).toEqual({
            project_ids: [3, 12],
            instrument_models: ["UVP6LP", "UVP5HD"],
            bounds: { north: 45, south: 40.5, east: 10, west: 3 },
            date_from: "2024-01-01",
            date_to: "2024-12-31",
            months: [6, 7],
            sample_names: ["moose_ge", "tara_"],
            hour_range: [6, 18.5],
            pressure_range: [0, 1000],
            privacy_statuses: ["public", "open"],
            my_projects: true,
            ctd_only: true,
            ecotaxa_imported_only: false,
            ecotaxa_exclude_not_living: false,
            classification_state: "fully_validated",
        });
    });

    test("a box crossing the antimeridian and an hour range crossing midnight are accepted", () => {
        const filters = parseExploreFilters({ bounds: { north: 30, south: -20, east: -170, west: 170 }, hour_range: [22, 3] });
        expect(filters?.bounds).toEqual({ north: 30, south: -20, east: -170, west: 170 });
        expect(filters?.hour_range).toEqual([22, 3]);
    });

    test("an empty date is no date", () => {
        expect(parseExploreFilters({ date_from: "", date_to: null })).toMatchObject({ date_from: null, date_to: null });
    });

    const refused: Array<[string, unknown, string]> = [
        ["filters as a string", "depth", "filters must be an object or null"],
        ["filters as an array", [1, 2], "filters must be an object or null"],
        ["project_ids not a list", { project_ids: "3" }, "project_ids must be an array"],
        ["project id 0", { project_ids: [0] }, `project_ids must contain integers between 1 and ${Number.MAX_SAFE_INTEGER}`],
        ["month 0", { months: [0] }, "months must contain integers between 1 and 12"],
        ["month 13", { months: [6, 13] }, "months must contain integers between 1 and 12"],
        ["month 1.5", { months: [1.5] }, "months must contain integers between 1 and 12"],
        ["an empty instrument", { instrument_models: [" "] }, "instrument_models must contain non-empty strings"],
        ["a numeric sample name", { sample_names: [42] }, "sample_names must contain non-empty strings"],
        ["an unknown privacy status", { privacy_statuses: ["secret"] }, "privacy_statuses must contain values among: private, visible, public, open"],
        ["bounds as a string", { bounds: "40,45,3,10" }, "bounds must be an object"],
        ["north beyond the pole", { bounds: { north: 91, south: 0, east: 0, west: 0 } }, "bounds.north must be a number between -90 and 90"],
        ["a missing east", { bounds: { north: 10, south: 0, west: 0 } }, "bounds.east must be a number between -180 and 180"],
        ["south above north", { bounds: { north: 10, south: 20, east: 0, west: 0 } }, "bounds.south must not exceed bounds.north"],
        ["a French date", { date_from: "12/06/2024" }, "date_from must be a date YYYY-MM-DD"],
        ["month 13 in a date", { date_to: "2024-13-01" }, "date_to must be a date YYYY-MM-DD"],
        ["dates in the wrong order", { date_from: "2024-12-31", date_to: "2024-01-01" }, "date_from must not exceed date_to"],
        ["a single hour", { hour_range: [6] }, "hour_range must be an array of two numbers"],
        ["hour 25", { hour_range: [0, 25] }, "hour_range must hold two numbers between 0 and 24"],
        ["a negative pressure", { pressure_range: [-1, 100] }, "pressure_range must hold two numbers between 0 and 20000"],
        ["a pressure beyond 20000", { pressure_range: [0, 20001] }, "pressure_range must hold two numbers between 0 and 20000"],
        ["a boolean as a word", { my_projects: "yes" }, "my_projects must be a boolean"],
        ["a boolean as a number", { ctd_only: 1 }, "ctd_only must be a boolean"],
        ["an unknown classification state", { classification_state: "half" }, "classification_state must be one of: all, fully_predicted, fully_validated"],
    ];

    test.each(refused)("refuses %s", (_, value, message) => {
        expect(() => parseExploreFilters(value)).toThrow(message);
    });

    test("refuses a day that does not exist", () => {
        expect(() => parseExploreFilters({ date_from: "2024-02-30" })).toThrow("date_from must be a date YYYY-MM-DD");
    });
});

describe("MiddlewareExploreValidation", () => {
    const validation = new MiddlewareExploreValidation();
    const app = express();
    app.use(express.json());
    const echo = (req: Request, res: Response) => { res.status(200).json(req.body); };
    app.post("/request", validation.rulesExploreRequest, echo);
    app.post("/graphs", validation.rulesExploreGraphs, echo);
    app.post("/images", validation.rulesExploreImages, echo);

    const messages = (body: { errors: Array<{ msg: string }> }) => body.errors.map(error => error.msg);

    describe("rulesExploreRequest", () => {
        test("passes a valid request on, with the filters parsed", async () => {
            const response = await request(app).post("/request").send({ mode: "depth", filters: { months: ["6"], ctd_only: "true" } });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ mode: "depth", filters: { ...DEFAULTS, months: [6], ctd_only: true } });
        });

        test("null filters stay null", async () => {
            const response = await request(app).post("/request").send({ mode: "time", filters: null });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ mode: "time", filters: null });
        });

        test("mode is required", async () => {
            const response = await request(app).post("/request").send({ filters: null });

            expect(response.status).toBe(422);
            expect(messages(response.body)).toContain("mode is required.");
        });

        test("mode is depth or time", async () => {
            const response = await request(app).post("/request").send({ mode: "profile", filters: null });

            expect(response.status).toBe(422);
            expect(messages(response.body)).toEqual(["mode must be one of: depth, time."]);
        });

        test.each([
            [{ months: [13] }, "months must contain integers between 1 and 12"],
            [{ bounds: { north: 10, south: 20, east: 0, west: 0 } }, "bounds.south must not exceed bounds.north"],
            [{ date_from: "2024-12-31", date_to: "2024-01-01" }, "date_from must not exceed date_to"],
        ])("bad filters %j answer 422 with the parser's message", async (filters, message) => {
            const response = await request(app).post("/request").send({ mode: "depth", filters });

            expect(response.status).toBe(422);
            expect(messages(response.body)).toEqual([message]);
            expect(response.body.errors[0]).toMatchObject({ path: "filters", location: "body" });
        });
    });

    describe("rulesExploreGraphs", () => {
        test("the steps are optional numbers", async () => {
            const without = await request(app).post("/graphs").send({ mode: "depth", filters: null });
            expect(without.status).toBe(200);
            expect(without.body).toEqual({ mode: "depth", filters: null });

            const nulls = await request(app).post("/graphs").send({ mode: "depth", filters: null, pressure_bin: null, time_bin: null });
            expect(nulls.status).toBe(200);

            const steps = await request(app).post("/graphs").send({ mode: "time", filters: null, pressure_bin: "10", time_bin: 0.5 });
            expect(steps.status).toBe(200);
            expect(steps.body).toEqual({ mode: "time", filters: null, pressure_bin: 10, time_bin: 0.5 });
        });

        test.each([
            [{ pressure_bin: 0 }, "pressure_bin must be a number between 1 and 100."],
            [{ pressure_bin: 101 }, "pressure_bin must be a number between 1 and 100."],
            [{ time_bin: 0.25 }, "time_bin must be a number between 0.5 and 24."],
            [{ time_bin: "a day" }, "time_bin must be a number between 0.5 and 24."],
        ])("refuses %j", async (steps, message) => {
            const response = await request(app).post("/graphs").send({ mode: "depth", filters: null, ...steps });

            expect(response.status).toBe(422);
            expect(messages(response.body)).toEqual([message]);
        });

        test("the request rules apply too", async () => {
            const response = await request(app).post("/graphs").send({ filters: { months: [0] } });

            expect(response.status).toBe(422);
            expect(messages(response.body)).toEqual(expect.arrayContaining(["mode is required.", "months must contain integers between 1 and 12"]));
        });
    });

    describe("rulesExploreImages", () => {
        test("count is an optional integer", async () => {
            const response = await request(app).post("/images").send({ mode: "depth", filters: null, count: "6" });

            expect(response.status).toBe(200);
            expect(response.body.count).toBe(6);
            expect((await request(app).post("/images").send({ mode: "depth", filters: null })).status).toBe(200);
        });

        test.each([0, 13, 2.5, "four"])("refuses count %p", async (count) => {
            const response = await request(app).post("/images").send({ mode: "depth", filters: null, count });

            expect(response.status).toBe(422);
            expect(messages(response.body)).toEqual(["count must be an integer between 1 and 12."]);
        });
    });
});
