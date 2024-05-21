import express from 'express'
import { Request, Response } from 'express'

// import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { GetOneInstrumentModelUseCase } from '../../domain/interfaces/use-cases/instrument_model/get-one-instrument_model'
import { SearchInstrumentModelsUseCase } from '../../domain/interfaces/use-cases/instrument_model/search-instrument_model'

export default function InstrumentModelsRouter(
    // middlewareAuth: MiddlewareAuth,
    getOneInstrumentModelsUseCase: GetOneInstrumentModelUseCase,
    searchInstrumentModelsUseCase: SearchInstrumentModelsUseCase
) {
    const router = express.Router()

    //    Pagined and sorted list of all instrument_models
    router.get('/', async (req: Request, res: Response) => {
        try {
            const instrument_models = await searchInstrumentModelsUseCase.execute({ ...req.query } as any);
            res.status(200).send(instrument_models)
        } catch (err) {
            console.log(err)
            if (err.message === "InstrumentModel is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't get instrument_models"] })
        }
    })
    router.get('/:instrument_model_id/', async (req: Request, res: Response) => {
        try {
            console.log(req.params.instrument_model_id)
            const instrument_model = await getOneInstrumentModelsUseCase.execute(req.params.instrument_model_id as any);
            res.status(200).send(instrument_model)
        } catch (err) {
            console.log(err)
            if (err.message === "Instrument model id not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't get instrument model"] })
        }
    })

    // router.post('/', middlewareInstrumentModelValidation.rulesInstrumentModelRequestCreationtModel, async (req: Request, res: Response) => {
    //     try {
    //         const created_instrument_model = await createInstrumentModelUseCase.execute(req.body)
    //         res.status(201).send(created_instrument_model)
    //     } catch (err) {
    //         console.log(err)
    //         if (err.message === "Valid instrument_model already exist") res.status(403).send({ errors: ["Can't create instrument_model"] })
    //         else if (err.message === "InstrumentModel is deleted") res.status(403).send({ errors: [err.message] })
    //         else if (err.message === "Can't update preexistent instrument_model") res.status(403).send({ errors: [err.message] })
    //         else if (err.message === "Can't find updated preexistent instrument_model") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Can't find created instrument_model") res.status(404).send({ errors: [err.message] })
    //         else res.status(500).send({ errors: ["Can't create instrument_model"] })
    //     }
    // })

    // router.patch('/:instrument_model_id/', middlewareInstrumentModelValidation.rulesInstrumentModelUpdateModel, middlewareAuth.auth, async (req: Request, res: Response) => {
    //     try {
    //         const updated_instrument_model = await updateInstrumentModelUseCase.execute((req as CustomRequest).token, { ...req.body, instrument_model_id: req.params.instrument_model_id })
    //         res.status(200).send(updated_instrument_model)
    //     } catch (err) {
    //         console.log(err)
    //         if (err.message === "Logged instrument_model cannot update this property or instrument_model") res.status(401).send({ errors: [err.message] })
    //         else if (err.message === "InstrumentModel is deleted") res.status(403).send({ errors: [err.message] })
    //         else if (err.message === "Can't find updated instrument_model") res.status(404).send({ errors: [err.message] })
    //         else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
    //         else res.status(500).send({ errors: ["Can't update instrument_model"] })
    //     }
    // })

    // router.delete('/:instrument_model_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
    //     try {
    //         await deleteInstrumentModelUseCase.execute((req as CustomRequest).token, { ...req.body, instrument_model_id: req.params.instrument_model_id })
    //         if ((req as CustomRequest).token.instrument_model_id == parseInt(req.params.instrument_model_id)) {
    //             res
    //                 .clearCookie("access_token")
    //                 .clearCookie("refresh_token")
    //                 .status(200)
    //                 .json({ message: "You have been Logged Out and permanently deleted" });
    //         } else
    //             res.status(200).send({ message: "InstrumentModel successfully deleted" })
    //     } catch (err) {
    //         console.log(err)
    //         if (err.message === "Logged instrument_model cannot delete this instrument_model") res.status(401).send({ errors: [err.message] })
    //         else if (err.message === "Can't find instrument_model to delete") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "InstrumentModel is deleted") res.status(403).send({ errors: [err.message] })
    //         else if (err.message === "Can't find deleted instrument_model") res.status(500).send({ errors: [err.message] })
    //         else res.status(500).send({ errors: ["Can't delete instrument_model"] })
    //     }
    // })

    return router
}