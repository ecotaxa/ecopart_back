import express, { NextFunction, Request, Response } from "express";
import request from "supertest";

import ExploreRouter from "../../../src/presentation/routers/explore-router";
import { MiddlewareExploreValidation } from "../../../src/presentation/middleware/explore-validation";
import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";
import { ExploreEcoTaxaResponse, ExploreGraphs, ExploreImage, ExploreMapSample, ExploreProjectOption, ExploreSelectionResponse } from "../../../src/domain/entities/explore";
import { ListExploreProjectsUseCase } from "../../../src/domain/interfaces/use-cases/explore/list-explore-projects";
import { GetExploreMapUseCase } from "../../../src/domain/interfaces/use-cases/explore/get-explore-map";
import { GetExploreSelectionUseCase } from "../../../src/domain/interfaces/use-cases/explore/get-explore-selection";
import { GetExploreEcoTaxaUseCase } from "../../../src/domain/interfaces/use-cases/explore/get-explore-ecotaxa";
import { GetExploreImagesUseCase } from "../../../src/domain/interfaces/use-cases/explore/get-explore-images";
import { GetExploreGraphsUseCase } from "../../../src/domain/interfaces/use-cases/explore/get-explore-graphs";

const LOGGED_TOKEN = { user_id: 7, is_admin: false } as DecodedToken;

// `auth` always authenticates; `auth_optional` lets the request through anonymous, or with a token when
// one is given (a logged-in caller with a valid cookie). Arrow properties, as in MiddlewareAuthCookie:
// the router hands the bare functions to Express.
class LocalMiddlewareAuth implements MiddlewareAuth {
    constructor(private readonly optional_token: DecodedToken | null = null) { }
    auth = (req: Request, __: Response, next: NextFunction): void => {
        (req as CustomRequest).token = LOGGED_TOKEN;
        next();
    };
    auth_optional = (req: Request, __: Response, next: NextFunction): void => {
        if (this.optional_token) (req as CustomRequest).token = this.optional_token;
        next();
    };
    auth_refresh = (): void => {
        throw new Error("Method not implemented for auth_refresh");
    };
}

// A caller without cookie: `auth` refuses it, `auth_optional` lets it through.
class AnonymousMiddlewareAuth extends LocalMiddlewareAuth {
    auth = (_: Request, res: Response): void => {
        res.status(401).send({ errors: ["Token missing. Please authenticate."] });
    };
}

class MockListExploreProjects implements ListExploreProjectsUseCase {
    execute(): Promise<ExploreProjectOption[]> { throw new Error("Method not implemented for execute"); }
}
class MockGetExploreMap implements GetExploreMapUseCase {
    execute(): Promise<ExploreMapSample[]> { throw new Error("Method not implemented for execute"); }
}
class MockGetExploreSelection implements GetExploreSelectionUseCase {
    execute(): Promise<ExploreSelectionResponse> { throw new Error("Method not implemented for execute"); }
}
class MockGetExploreEcoTaxa implements GetExploreEcoTaxaUseCase {
    execute(): Promise<ExploreEcoTaxaResponse> { throw new Error("Method not implemented for execute"); }
}
class MockGetExploreImages implements GetExploreImagesUseCase {
    execute(): Promise<ExploreImage[]> { throw new Error("Method not implemented for execute"); }
}
class MockGetExploreGraphs implements GetExploreGraphsUseCase {
    execute(): Promise<ExploreGraphs> { throw new Error("Method not implemented for execute"); }
}

const PROJECTS: ExploreProjectOption[] = [{ project_id: 1, project_title: "Ligurian profiles", nb_samples: 30 }];
const MAP: ExploreMapSample[] = [{ sample_id: 1, sample_name: "moose_001", project_id: 1, project_title: "Ligurian profiles", latitude: 43.4, longitude: 7.87, instrument_model: "UVP6LP", privacy_status: "open", is_my_project: false }];
const SELECTION: ExploreSelectionResponse = { all: { summary: null, projects: [] }, exportable: { summary: null, projects: [] } };
const SUMMARY = { categories: ["Copepoda"], classification: { fully_validated: 100, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 }, nb_samples_with_stats: 1, partial: false, nb_samples_pending: 0 };
const ECOTAXA: ExploreEcoTaxaResponse = { all: SUMMARY, exportable: SUMMARY };
const IMAGES: ExploreImage[] = [{ object_id: 42, image_url: "https://ecotaxa.obs-vlfr.fr/vault/1/42.jpg", sample_name: "moose_001", depth: 12.5, date: null }];
const EMPTY = { keys: [], axis_labels: {}, series: {} };
const GRAPHS: ExploreGraphs = { abundance: EMPTY, biovolume: EMPTY, ctd: EMPTY, ecotaxa: EMPTY, warnings: ["1 sample of private projects is not drawn"] };

const FILTERS_SENT = { months: ["6"], ctd_only: "true", classification_state: "fully_validated" };
const FILTERS_PARSED = {
    project_ids: [], instrument_models: [], bounds: null, date_from: null, date_to: null, months: [6], sample_names: [], hour_range: null,
    pressure_range: null, privacy_statuses: [], my_projects: false, ctd_only: true, ecotaxa_imported_only: false, ecotaxa_exclude_not_living: false,
    classification_state: "fully_validated",
};

describe("ExploreRouter", () => {
    let listExploreProjects: ListExploreProjectsUseCase;
    let getExploreMap: GetExploreMapUseCase;
    let getExploreSelection: GetExploreSelectionUseCase;
    let getExploreEcoTaxa: GetExploreEcoTaxaUseCase;
    let getExploreImages: GetExploreImagesUseCase;
    let getExploreGraphs: GetExploreGraphsUseCase;

    function serverWith(auth: MiddlewareAuth): express.Express {
        // A local app rather than src/server, so these routes cannot leak into the other router suites.
        const server = express();
        server.use(express.json());
        server.use("/explore", ExploreRouter(auth, new MiddlewareExploreValidation(), listExploreProjects, getExploreMap, getExploreSelection, getExploreEcoTaxa, getExploreImages, getExploreGraphs));
        return server;
    }

    let anonymous: express.Express;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        listExploreProjects = new MockListExploreProjects();
        getExploreMap = new MockGetExploreMap();
        getExploreSelection = new MockGetExploreSelection();
        getExploreEcoTaxa = new MockGetExploreEcoTaxa();
        getExploreImages = new MockGetExploreImages();
        getExploreGraphs = new MockGetExploreGraphs();
        jest.spyOn(listExploreProjects, "execute").mockResolvedValue(PROJECTS);
        jest.spyOn(getExploreMap, "execute").mockResolvedValue(MAP);
        jest.spyOn(getExploreSelection, "execute").mockResolvedValue(SELECTION);
        jest.spyOn(getExploreEcoTaxa, "execute").mockResolvedValue(ECOTAXA);
        jest.spyOn(getExploreImages, "execute").mockResolvedValue(IMAGES);
        jest.spyOn(getExploreGraphs, "execute").mockResolvedValue(GRAPHS);
        anonymous = serverWith(new LocalMiddlewareAuth());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("anonymous callers are served by every route but /graphs", () => {
        test("GET /explore/projects", async () => {
            const response = await request(anonymous).get("/explore/projects");

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ projects: PROJECTS });
            expect(listExploreProjects.execute).toBeCalledWith(null);
        });

        test("POST /explore/map", async () => {
            const response = await request(anonymous).post("/explore/map").send({ mode: "depth", filters: FILTERS_SENT });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ samples: MAP });
            expect(getExploreMap.execute).toBeCalledWith(null, { mode: "depth", filters: FILTERS_PARSED });
        });

        test("POST /explore/selection", async () => {
            const response = await request(anonymous).post("/explore/selection").send({ mode: "time", filters: null });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(SELECTION);
            expect(getExploreSelection.execute).toBeCalledWith(null, { mode: "time", filters: null });
        });

        test("POST /explore/ecotaxa", async () => {
            const response = await request(anonymous).post("/explore/ecotaxa").send({ mode: "depth", filters: FILTERS_SENT });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(ECOTAXA);
            expect(getExploreEcoTaxa.execute).toBeCalledWith(null, { mode: "depth", filters: FILTERS_PARSED });
        });

        test("POST /explore/images, count optional", async () => {
            const with_count = await request(anonymous).post("/explore/images").send({ mode: "depth", filters: null, count: 6 });
            expect(with_count.status).toBe(200);
            expect(with_count.body).toEqual({ images: IMAGES });
            expect(getExploreImages.execute).toBeCalledWith(null, { mode: "depth", filters: null, count: 6 });

            await request(anonymous).post("/explore/images").send({ mode: "depth", filters: null });
            expect(getExploreImages.execute).toHaveBeenLastCalledWith(null, { mode: "depth", filters: null, count: undefined });
        });

        test("a missing filters field is sent as null", async () => {
            await request(anonymous).post("/explore/map").send({ mode: "depth" });

            expect(getExploreMap.execute).toBeCalledWith(null, { mode: "depth", filters: null });
        });

        test("POST /explore/graphs needs the authentication of `auth`", async () => {
            const server = serverWith(new AnonymousMiddlewareAuth());

            const graphs = await request(server).post("/explore/graphs").send({ mode: "depth", filters: null });
            expect(graphs.status).toBe(401);
            expect(getExploreGraphs.execute).toBeCalledTimes(0);

            // The same caller is served elsewhere, through `auth_optional`.
            const map = await request(server).post("/explore/map").send({ mode: "depth", filters: null });
            expect(map.status).toBe(200);
        });
    });

    describe("logged-in callers", () => {
        test("the token set by `auth_optional` is the user of the use case", async () => {
            const token = { user_id: 12, is_admin: false } as DecodedToken;
            const server = serverWith(new LocalMiddlewareAuth(token));

            await request(server).get("/explore/projects");
            await request(server).post("/explore/selection").send({ mode: "depth", filters: null });

            expect(listExploreProjects.execute).toBeCalledWith(token);
            expect(getExploreSelection.execute).toBeCalledWith(token, { mode: "depth", filters: null });
        });

        test("POST /explore/graphs passes the user and the steps", async () => {
            const response = await request(anonymous).post("/explore/graphs").send({ mode: "time", filters: FILTERS_SENT, time_bin: "2", pressure_bin: 10 });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(GRAPHS);
            expect(getExploreGraphs.execute).toBeCalledWith(LOGGED_TOKEN, { mode: "time", filters: FILTERS_PARSED, pressure_bin: 10, time_bin: 2 });
        });

        test("POST /explore/graphs without steps leaves them to the use case", async () => {
            await request(anonymous).post("/explore/graphs").send({ mode: "depth", filters: null, pressure_bin: null });

            expect(getExploreGraphs.execute).toBeCalledWith(LOGGED_TOKEN, { mode: "depth", filters: null, pressure_bin: undefined, time_bin: undefined });
        });
    });

    describe("validation errors answer 422 before any use case", () => {
        test.each([
            ["/explore/map", { filters: null }],
            ["/explore/selection", { mode: "profile", filters: null }],
            ["/explore/ecotaxa", { mode: "depth", filters: { months: [13] } }],
            ["/explore/images", { mode: "depth", filters: null, count: 20 }],
            ["/explore/graphs", { mode: "depth", filters: null, pressure_bin: 0 }],
        ])("POST %s %j", async (route, body) => {
            const response = await request(anonymous).post(route).send(body);

            expect(response.status).toBe(422);
            expect(response.body.errors.length).toBeGreaterThan(0);
            for (const useCase of [getExploreMap, getExploreSelection, getExploreEcoTaxa, getExploreImages, getExploreGraphs]) {
                expect(useCase.execute).toBeCalledTimes(0);
            }
        });
    });

    describe("domain errors are mapped to status codes", () => {
        type Route = { method: "get" | "post"; path: string; body?: object; useCase: () => { execute(...args: any[]): Promise<unknown> }; fallback: string };
        const routes: Route[] = [
            { method: "get", path: "/explore/projects", useCase: () => listExploreProjects, fallback: "Cannot list the explore projects" },
            { method: "post", path: "/explore/map", body: { mode: "depth", filters: null }, useCase: () => getExploreMap, fallback: "Cannot get the explore map" },
            { method: "post", path: "/explore/selection", body: { mode: "depth", filters: null }, useCase: () => getExploreSelection, fallback: "Cannot get the explore selection" },
            { method: "post", path: "/explore/ecotaxa", body: { mode: "depth", filters: null }, useCase: () => getExploreEcoTaxa, fallback: "Cannot get the explore EcoTaxa summary" },
            { method: "post", path: "/explore/images", body: { mode: "depth", filters: null }, useCase: () => getExploreImages, fallback: "Cannot get the explore images" },
            { method: "post", path: "/explore/graphs", body: { mode: "depth", filters: null }, useCase: () => getExploreGraphs, fallback: "Cannot get the explore graphs" },
        ];
        const send = (route: Route) => route.method === "get" ? request(anonymous).get(route.path) : request(anonymous).post(route.path).send(route.body);
        const cases: Array<[string, number]> = [
            ["User cannot be used", 403],
            ["Login required", 401],
            ["pressure_bin must be between 1 and 100", 422],
            ["time_bin must be between 0.5 and 24", 422],
            ["count must be between 1 and 12", 422],
        ];

        for (const route of routes) {
            test.each(cases)(`${route.method.toUpperCase()} ${route.path}: '%s' → %i`, async (message, status) => {
                jest.spyOn(route.useCase(), "execute").mockRejectedValue(new Error(message));

                const response = await send(route);

                expect(response.status).toBe(status);
                expect(response.body).toEqual({ errors: [message] });
            });

            test(`${route.method.toUpperCase()} ${route.path}: an unexpected error is masked behind a 500`, async () => {
                jest.spyOn(route.useCase(), "execute").mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));

                const response = await send(route);

                expect(response.status).toBe(500);
                expect(response.body).toEqual({ errors: [route.fallback] });
            });
        }
    });
});
