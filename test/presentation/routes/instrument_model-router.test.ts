
import request from "supertest";
import server from '../../../src/server'

import InstrumentModelsRouter from '../../../src/presentation/routers/instrument_model-router'

import { IMiddlewareInstrumentModelValidation } from '../../../src/presentation/interfaces/middleware/instrument_model-validation'

import { GetOneInstrumentModelUseCase } from "../../../src/domain/interfaces/use-cases/instrument_model/get-one-instrument_model"
import { SearchInstrumentModelsUseCase } from '../../../src/domain/interfaces/use-cases/instrument_model/search-instrument_model'

import { MockGetOneInstrumentModelUseCase, MockSearchInstrumentModelsUseCase } from "../../mocks/instrumentModel-mock";


class MockMiddlewareInstrumentModelValidation implements IMiddlewareInstrumentModelValidation {
    rulesGetInstrumentModels = []
}

describe('InstrumentModelsRouter', () => {

    let getOneInstrumentModelsUseCase: GetOneInstrumentModelUseCase
    let searchInstrumentModelsUseCase: SearchInstrumentModelsUseCase
    let middlewareInstrumentModelValidation: MockMiddlewareInstrumentModelValidation

    beforeAll(() => {
        getOneInstrumentModelsUseCase = new MockGetOneInstrumentModelUseCase()
        searchInstrumentModelsUseCase = new MockSearchInstrumentModelsUseCase()
        middlewareInstrumentModelValidation = new MockMiddlewareInstrumentModelValidation()

        server.use("/instrument_models", InstrumentModelsRouter(getOneInstrumentModelsUseCase, searchInstrumentModelsUseCase, middlewareInstrumentModelValidation))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /instrument_models", () => {
        // Test for GET /instrument_models runs well
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                "search_info": {
                    "total": 7,
                    "limit": 1000,
                    "total_on_page": 7,
                    "page": 1,
                    "pages": 1
                },
                "instrument_models": [
                    {
                        "instrument_model_id": 1,
                        "instrument_model_name": "UVP5HD",
                        "bodc_url": "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/",
                        "instrument_model_creation_date": "2024-11-20 16:34:16"
                    },
                    {
                        "instrument_model_id": 2,
                        "instrument_model_name": "UVP5SD",
                        "bodc_url": "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/",
                        "instrument_model_creation_date": "2024-11-20 16:34:16"
                    },
                    {
                        "instrument_model_id": 3,
                        "instrument_model_name": "UVP5Z",
                        "bodc_url": "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/",
                        "instrument_model_creation_date": "2024-11-20 16:34:16"
                    },
                    {
                        "instrument_model_id": 5,
                        "instrument_model_name": "UVP6HF",
                        "bodc_url": "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/",
                        "instrument_model_creation_date": "2024-11-20 16:34:16"
                    },
                    {
                        "instrument_model_id": 4,
                        "instrument_model_name": "UVP6LP",
                        "bodc_url": "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/",
                        "instrument_model_creation_date": "2024-11-20 16:34:16"
                    },
                    {
                        "instrument_model_id": 7,
                        "instrument_model_name": "UVP6MHF",
                        "bodc_url": "Not registred in BODC for now",
                        "instrument_model_creation_date": "2024-11-20 16:34:16"
                    },
                    {
                        "instrument_model_id": 6,
                        "instrument_model_name": "UVP6MHP",
                        "bodc_url": "Not registred in BODC for now",
                        "instrument_model_creation_date": "2024-11-20 16:34:16"
                    }
                ]
            }

            jest.spyOn(searchInstrumentModelsUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            const response = await request(server).get("/instrument_models")

            expect(response.status).toBe(200)
            expect(searchInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });

        // Test for GET /instrument_models failed because of Unauthorized or unexisting parameters, Invalid sorting statement, Cannot search instrument models, Cannot get instrument_models
        test("Should return 401 with error message : Unauthorized or unexisting parameters", async () => {
            jest.spyOn(searchInstrumentModelsUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters") })
            const response = await request(server).get("/instrument_models")

            expect(response.status).toBe(401)
            expect(searchInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Unauthorized or unexisting parameters"] })

        });
        test("Should return 401 with error message : Invalid sorting statement", async () => {
            jest.spyOn(searchInstrumentModelsUseCase, "execute").mockImplementation(() => { throw new Error("Invalid sorting statement") })
            const response = await request(server).get("/instrument_models")

            expect(response.status).toBe(401)
            expect(searchInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Invalid sorting statement"] })

        });
        test("Should return 500 with error message : Cannot search instrument models", async () => {
            jest.spyOn(searchInstrumentModelsUseCase, "execute").mockImplementation(() => { throw new Error("Cannot search instrument models") })
            const response = await request(server).get("/instrument_models")

            expect(response.status).toBe(500)
            expect(searchInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Cannot search instrument models"] })

        });
        test("Should return 500 with error message : Cannot get instrument_models", async () => {
            jest.spyOn(searchInstrumentModelsUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).get("/instrument_models")

            expect(response.status).toBe(500)
            expect(searchInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Cannot get instrument_models"] })

        });
    })

    describe("Tests for GET /instrument_models/:instrument_model_id", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                "instrument_model_id": 1,
                "instrument_model_name": "UVP5HD",
                "bodc_url": "https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/",
                "instrument_model_creation_date": "2024-11-20 16:34:16"
            }

            jest.spyOn(getOneInstrumentModelsUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            const response = await request(server).get("/instrument_models/1")

            expect(response.status).toBe(200)
            expect(getOneInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });

        test("Should return 404 with error message : Cannot find instrument_model", async () => {
            jest.spyOn(getOneInstrumentModelsUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find instrument_model") })
            const response = await request(server).get("/instrument_models/1")

            expect(response.status).toBe(404)
            expect(getOneInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Cannot find instrument_model"] })
        });

        test("Should return 500 with error message : Cannot get instrument model", async () => {
            jest.spyOn(getOneInstrumentModelsUseCase, "execute").mockImplementation(() => { throw new Error("xyz") })
            const response = await request(server).get("/instrument_models/1")

            expect(response.status).toBe(500)
            expect(getOneInstrumentModelsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Cannot get instrument model"] })
        });
    })
})
