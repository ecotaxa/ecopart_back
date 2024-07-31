//test/domain/repositories/instrument_model-repository.test.ts
import { cat } from "shelljs";
import { InstrumentModelDataSource } from "../../../src/data/interfaces/data-sources/instrument_model-data-source";
import { InstrumentModelRepository } from "../../../src/domain/interfaces/repositories/instrument_model-repository";
import { InstrumentModelRepositoryImpl } from "../../../src/domain/repositories/instrument_model-repository";
import { instrument_model_request_id, instrument_model_response } from "../../entities/instrumentModel";
import { MockInstrumentModelDataSource } from "../../mocks/instrumentModel-mock";

import 'dotenv/config'

describe("InstrumentModel Repository", () => {
    let mockInstrumentModelDataSource: InstrumentModelDataSource;

    let instrument_modelRepository: InstrumentModelRepository

    beforeEach(() => {
        jest.clearAllMocks();
        mockInstrumentModelDataSource = new MockInstrumentModelDataSource()
        instrument_modelRepository = new InstrumentModelRepositoryImpl(mockInstrumentModelDataSource)
    })

    // to test getOneInstrumentModel, standardGetInstrumentModels, getInstrumentByName

    describe("GetOneInstrumentModel", () => {
        test("Should get a instrument_model", async () => {

            jest.spyOn(mockInstrumentModelDataSource, 'getOne').mockResolvedValue(instrument_model_response)

            const result = await instrument_modelRepository.getOneInstrumentModel(instrument_model_request_id)

            expect(mockInstrumentModelDataSource.getOne).toBeCalledWith(instrument_model_request_id)
            expect(result).toBe(instrument_model_response)
        })
        test("Should return null if no instrument_model is found", async () => {

            jest.spyOn(mockInstrumentModelDataSource, 'getOne').mockResolvedValue(null)

            const result = await instrument_modelRepository.getOneInstrumentModel(instrument_model_request_id)

            expect(mockInstrumentModelDataSource.getOne).toBeCalledWith(instrument_model_request_id)
            expect(result).toBe(null)
        });
    });

    describe("StandardGetInstrumentModels", () => {
        test("Should get all instrument_models", async () => {
            const options = { page: 1, limit: 10, sort_by: [], filter: [] }
            const result = { items: [instrument_model_response], total: 1 }

            jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue(result)

            const response = await instrument_modelRepository.standardGetInstrumentModels(options)

            expect(mockInstrumentModelDataSource.getAll).toBeCalledWith(options)
            expect(response).toBe(result)
        })
        test("Should get all instrument_models with sort_by and filter", async () => {
            const result = { items: [instrument_model_response], total: 1 }
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "instrument_model_name", order_by: "asc" }],
                filter: [{ field: "instrument_model_name", operator: "LIKE", value: "UVP%" }]
            }
            jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue(result)

            const response = await instrument_modelRepository.standardGetInstrumentModels(options)

            expect(mockInstrumentModelDataSource.getAll).toBeCalledWith(options)
            expect(response).toBe(result)
        });
        test("Should return error for unauthorized sort_by", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "unauthorized_param", order_by: "asc" }],
                filter: [{ field: "instrument_model_name", operator: "LIKE", value: "UVP%" }]
            }
            jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await instrument_modelRepository.standardGetInstrumentModels(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized sort_by: unauthorized_param")
            }
            expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
        });
        test("Should return error for unauthorized order_by", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "instrument_model_name", order_by: "unauthorized_param" }],
                filter: [{ field: "instrument_model_name", operator: "LIKE", value: "UVP%" }]
            }
            jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await instrument_modelRepository.standardGetInstrumentModels(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized order_by: unauthorized_param")
            }
            expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
        });
        test("Should return error for unauthorized filter field", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [],
                filter: [{ field: "unauthorized_param", operator: "IN", value: "[1,2]" }]
            }
            jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await instrument_modelRepository.standardGetInstrumentModels(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Filter field: unauthorized_param")
            }
            expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
        });
        test("Should return error for unauthorized filter operator", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [],
                filter: [{ field: "instrument_model_name", operator: "unauthorized_param", value: "UVP%" }]
            }
            jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await instrument_modelRepository.standardGetInstrumentModels(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Filter operator: unauthorized_param")
            }
            expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
        });
    });
    describe("GetInstrumentByName", () => {
        test("Should get a instrument_model by name", async () => {
            const instrument_model_name = "UVP5HD"

            jest.spyOn(mockInstrumentModelDataSource, 'getOne').mockResolvedValue(instrument_model_response)

            const result = await instrument_modelRepository.getInstrumentByName(instrument_model_name)

            expect(mockInstrumentModelDataSource.getOne).toBeCalledWith({ "instrument_model_name": instrument_model_name })
            expect(result).toBe(instrument_model_response)

        })
        test("Should return null if no instrument_model is found", async () => {
            const instrument_model_name = "UVP5HD"

            jest.spyOn(mockInstrumentModelDataSource, 'getOne').mockResolvedValue(null)
            try {
                await instrument_modelRepository.getInstrumentByName(instrument_model_name)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Instrument not found")
                expect(mockInstrumentModelDataSource.getOne).toBeCalledWith({ "instrument_model_name": instrument_model_name })
            }
        });
    });




    // describe("CreateInstrumentModel", () => {
    //     test("Should create a instrument_model", async () => {
    //         const instrument_model: InstrumentModelRequestCreationModel = instrument_modelRequestCreationModelForRepository

    //         jest.spyOn(mockInstrumentModelDataSource, 'create').mockResolvedValue(1)

    //         const result = await instrument_modelRepository.cre(instrument_model)

    //         expect(mockInstrumentModelDataSource.create).toBeCalledWith(instrument_model)
    //         expect(result).toBe(1)
    //     })
    // })

    // describe("GetInstrumentModel", () => {
    //     test("Should get a instrument_model", async () => {
    //         const instrument_model: InstrumentModelRequestModel = { instrument_model_id: 1 }
    //         const instrument_modelResponse: InstrumentModelResponseModel = instrument_modelResponseModel

    //         jest.spyOn(mockInstrumentModelDataSource, 'getOne').mockResolvedValue(instrument_modelResponse)

    //         const result = await instrument_modelRepository.getInstrumentModel(instrument_model)

    //         expect(mockInstrumentModelDataSource.getOne).toBeCalledWith(instrument_model)
    //         expect(result).toBe(instrument_modelResponse)
    //     })

    // })

    // describe("ComputeDefaultDepthOffset", () => {
    //     test("Should compute default depth offset", async () => {
    //         const instrument_model = "UVP5HD"
    //         const result = instrument_modelRepository.computeDefaultDepthOffset(instrument_model)

    //         expect(result).toBe(1.2)
    //     })

    //     test("Should throw an error if instrument is undefined", async () => {
    //         const instrument_model = undefined as any
    //         expect(() => instrument_modelRepository.computeDefaultDepthOffset(instrument_model)).toThrowError("Instrument is required")
    //     })

    //     test("Should return undefined if instrument is not uvp5", async () => {
    //         const instrument_model = "not_uvp5"
    //         const result = instrument_modelRepository.computeDefaultDepthOffset(instrument_model)

    //         expect(result).toBe(undefined)
    //     })
    // })

    // describe("DeleteInstrumentModel", () => {
    //     test("Should delete a instrument_model", async () => {
    //         const instrument_model: InstrumentModelRequestModel = { instrument_model_id: 1 }

    //         jest.spyOn(mockInstrumentModelDataSource, 'deleteOne').mockResolvedValue(1)

    //         const result = await instrument_modelRepository.deleteInstrumentModel(instrument_model)

    //         expect(mockInstrumentModelDataSource.deleteOne).toBeCalledWith(instrument_model)
    //         expect(result).toBe(1)
    //     })
    // });

    // describe("UpdateInstrumentModel", () => {
    //     //TODO
    //     test("Should update a instrument_model", async () => {
    //         const instrument_model: InstrumentModelUpdateModel = privateInstrumentModelUpdateModel

    //         jest.spyOn(mockInstrumentModelDataSource, 'updateOne').mockResolvedValue(1)

    //         const result = await instrument_modelRepository.standardUpdateInstrumentModel(instrument_model)

    //         expect(mockInstrumentModelDataSource.updateOne).toBeCalledWith(instrument_model)
    //         expect(result).toBe(1)
    //     })

    //     test("Should throw an error if unauthorized params are found", async () => {
    //         const instrument_model = instrument_modelUpdateModel_withBadData

    //         jest.spyOn(mockInstrumentModelDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

    //         try {
    //             await instrument_modelRepository.standardUpdateInstrumentModel(instrument_model)
    //         } catch (e) {
    //             expect(e).toBeInstanceOf(Error)
    //             expect(e.message).toBe("Unauthorized or unexisting parameters : unauthorized_param")
    //         }
    //         // exceptget all have been called with
    //         expect(mockInstrumentModelDataSource.updateOne).not.toBeCalled()

    //     })

    //     test("Should throw an error if no valid parameter is provided", async () => {
    //         const instrument_model = { instrument_model_id: 1 }

    //         jest.spyOn(mockInstrumentModelDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

    //         try {
    //             await instrument_modelRepository.standardUpdateInstrumentModel(instrument_model as InstrumentModelUpdateModel)
    //         } catch (e) {
    //             expect(e).toBeInstanceOf(Error)
    //             expect(e.message).toBe("Please provide at least one valid parameter to update")
    //         }
    //         // exceptget all have been called with
    //         expect(mockInstrumentModelDataSource.updateOne).not.toBeCalled()
    //     })

    // });
    // describe("GetInstrumentModels", () => {
    //     test("Should get all instrument_models", async () => {
    //         const options = { page: 1, limit: 10, sort_by: [], filter: [] }
    //         const result: SearchResult<InstrumentModelResponseModel> = {
    //             items: instrument_modelResponseModelArray,
    //             total: 2
    //         }

    //         jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue(result)

    //         const response = await instrument_modelRepository.standardGetInstrumentModels(options)

    //         expect(mockInstrumentModelDataSource.getAll).toBeCalledWith(options)
    //         expect(response).toBe(result)
    //     })
    //     test("Should get all instrument_models with sort_by and filter", async () => {
    //         const result: SearchResult<InstrumentModelResponseModel> = {
    //             items: instrument_modelResponseModelArray,
    //             total: 2
    //         }
    //         const options = {
    //             page: 1,
    //             limit: 10,
    //             sort_by: [{ sort_by: "instrument_model_title", order_by: "asc" }],
    //             filter: [{ field: "instrument_model_id", operator: "IN", value: "[1,2]" }]
    //         }
    //         jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue(result)

    //         const response = await instrument_modelRepository.standardGetInstrumentModels(options)

    //         expect(mockInstrumentModelDataSource.getAll).toBeCalledWith(options)
    //         expect(response).toBe(result)
    //     })
    //     test("Should return error for unauthorized sort_by", async () => {
    //         const options = {
    //             page: 1,
    //             limit: 10,
    //             sort_by: [{ sort_by: "unauthorized_param", order_by: "asc" }],
    //             filter: [{ field: "instrument_model_id", operator: "IN", value: "[1,2]" }]
    //         }
    //         jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

    //         try {
    //             await instrument_modelRepository.standardGetInstrumentModels(options)
    //         } catch (e) {
    //             expect(e).toBeInstanceOf(Error)
    //             expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized sort_by: unauthorized_param")
    //         }
    //         expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
    //     })
    //     test("Should return error for unauthorized order_by", async () => {
    //         const options = {
    //             page: 1,
    //             limit: 10,
    //             sort_by: [{ sort_by: "instrument_model_title", order_by: "unauthorized_param" }],
    //             filter: [{ field: "instrument_model_id", operator: "IN", value: "[1,2]" }]
    //         }
    //         jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

    //         try {
    //             await instrument_modelRepository.standardGetInstrumentModels(options)
    //         } catch (e) {
    //             expect(e).toBeInstanceOf(Error)
    //             expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized order_by: unauthorized_param")
    //         }
    //         expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
    //     })
    //     test("Should return error for unauthorized filter field", async () => {
    //         const options = {
    //             page: 1,
    //             limit: 10,
    //             sort_by: [{ sort_by: "instrument_model_title", order_by: "asc" }],
    //             filter: [{ field: "unauthorized_param", operator: "IN", value: "[1,2]" }]
    //         }
    //         jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

    //         try {
    //             await instrument_modelRepository.standardGetInstrumentModels(options)
    //         } catch (e) {
    //             expect(e).toBeInstanceOf(Error)
    //             expect(e.message).toBe("Unauthorized or unexisting parameters : Filter field: unauthorized_param")
    //         }
    //         expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
    //     })
    //     test("Should return error for unauthorized filter operator", async () => {
    //         const options = {
    //             page: 1,
    //             limit: 10,
    //             sort_by: [{ sort_by: "instrument_model_title", order_by: "asc" }],
    //             filter: [{ field: "instrument_model_id", operator: "unauthorized_param", value: "[1,2]" }]
    //         }
    //         jest.spyOn(mockInstrumentModelDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

    //         try {
    //             await instrument_modelRepository.standardGetInstrumentModels(options)
    //         } catch (e) {
    //             expect(e).toBeInstanceOf(Error)
    //             expect(e.message).toBe("Unauthorized or unexisting parameters : Filter operator: unauthorized_param")
    //         }
    //         expect(mockInstrumentModelDataSource.getAll).not.toBeCalled()
    //     })

    // })


})
