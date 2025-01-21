import request from "supertest";
import server from '../../../src/server'

import InstrumentModelsRouter from "../../../src/presentation/routers/instrument_model-router";

import { SearchInstrument_modelResult } from "../../entities/instrumentModel";
import { MockGetOneInstrumentModelUseCase, MockSearchInstrumentModelsUseCase } from "../../mocks/instrumentModel-mock";
import { SearchInstrumentModelsUseCase } from "../../../src/domain/interfaces/use-cases/instrument_model/search-instrument_model";
import { GetOneInstrumentModelUseCase } from "../../../src/domain/interfaces/use-cases/instrument_model/get-one-instrument_model";
import { IMiddlewareInstrumentModelValidation } from "../../../src/presentation/interfaces/middleware/instrument_model-validation";
import { MiddlewareInstrumentModelValidation } from "../../../src/presentation/middleware/instrument_model-validation";

describe("Instrument model Router", () => {
    let modkGetOneInstrumentModelsUseCase: GetOneInstrumentModelUseCase;
    let mockSearchInstrumentModelUseCase: SearchInstrumentModelsUseCase;
    let middlewareInstrumentModelValidation: IMiddlewareInstrumentModelValidation;

    beforeAll(() => {
        modkGetOneInstrumentModelsUseCase = new MockGetOneInstrumentModelUseCase()
        mockSearchInstrumentModelUseCase = new MockSearchInstrumentModelsUseCase()
        middlewareInstrumentModelValidation = new MiddlewareInstrumentModelValidation()

        server.use("/instrument-models", InstrumentModelsRouter(modkGetOneInstrumentModelsUseCase, mockSearchInstrumentModelUseCase, middlewareInstrumentModelValidation))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Test instrument-model router rules GetUsers", () => {
        test("Get instrument-model all params are valid", async () => {
            const OutputData = SearchInstrument_modelResult
            const options = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }
            jest.spyOn(mockSearchInstrumentModelUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/instrument-models").query(options)

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchInstrumentModelUseCase.execute).toBeCalledTimes(1)
        });

        test("Get instrument-model with invalid page", async () => {
            const options = {
                page: "a",
                limit: 10,
                sort_by: "asc(user_id)"
            }
            const OutputData = {
                "errors": [
                    {
                        "location": "query",
                        "msg": "Page must be a number and must be greater than 0.",
                        "path": "page",
                        "type": "field",
                        "value": "a"
                    }
                ]
            }
            jest.spyOn(mockSearchInstrumentModelUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/instrument-models").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchInstrumentModelUseCase.execute).not.toBeCalled()
        });

        test("Get instrument-model with invalid limit", async () => {
            const options = {
                page: 1,
                limit: "a",
                sort_by: "asc(user_id)"
            }
            const OutputData = {
                "errors": [
                    {
                        "location": "query",
                        "msg": "Limit must be a number and must be greater than 0.",
                        "path": "limit",
                        "type": "field",
                        "value": "a"
                    }
                ]
            }
            jest.spyOn(mockSearchInstrumentModelUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/instrument-models").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchInstrumentModelUseCase.execute).not.toBeCalled()
        });

        test("get instrument-model with default params", async () => {
            const OutputData = SearchInstrument_modelResult
            jest.spyOn(mockSearchInstrumentModelUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/instrument-models")

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchInstrumentModelUseCase.execute).toBeCalledTimes(1)

        });

    });

})

