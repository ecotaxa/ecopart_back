import express from 'express'
import { Request, Response } from 'express'

import { GetOneInstrumentModelUseCase } from '../../domain/interfaces/use-cases/instrument_model/get-one-instrument_model'
import { SearchInstrumentModelsUseCase } from '../../domain/interfaces/use-cases/instrument_model/search-instrument_model'
import { IMiddlewareInstrumentModelValidation } from '../interfaces/middleware/instrument_model-validation'

export default function InstrumentModelsRouter(
    getOneInstrumentModelsUseCase: GetOneInstrumentModelUseCase,
    searchInstrumentModelsUseCase: SearchInstrumentModelsUseCase,
    middlewareInstrumentModelValidation: IMiddlewareInstrumentModelValidation
) {
    const router = express.Router()

    // Pagined and sorted list of all instrument_models
    router.get('/', middlewareInstrumentModelValidation.rulesGetInstrumentModels, async (req: Request, res: Response) => {
        try {
            const instrument_models = await searchInstrumentModelsUseCase.execute({ ...req.query } as any);
            res.status(200).send(instrument_models)
        } catch (err) {
            console.log(err)
            if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Cannot search instrument models")) res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get instrument_models"] })
        }
    })
    router.get('/:instrument_model_id/', async (req: Request, res: Response) => {
        try {
            const instrument_model = await getOneInstrumentModelsUseCase.execute(req.params.instrument_model_id as any);
            res.status(200).send(instrument_model)
        } catch (err) {
            console.log(err)
            if (err.message === "Cannot find instrument_model") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get instrument model"] })
        }
    })
    return router
}