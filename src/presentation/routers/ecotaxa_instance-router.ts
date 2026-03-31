import express from 'express'
import { Request, Response } from 'express'
import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { CustomRequest } from '../../domain/entities/auth'
import { GetAllEcoTaxaInstancesUseCase } from '../../domain/interfaces/use-cases/ecotaxa_instance/get-all-ecotaxa-instances'
import { CreateEcoTaxaInstanceUseCase } from '../../domain/interfaces/use-cases/ecotaxa_instance/create-ecotaxa-instance'

export default function EcoTaxaInstanceRouter(
    middlewareAuth: MiddlewareAuth,
    getAllEcoTaxaInstancesUseCase: GetAllEcoTaxaInstancesUseCase,
    createEcoTaxaInstanceUseCase: CreateEcoTaxaInstanceUseCase,
) {
    const router = express.Router()

    /**
     * @openapi
     * /ecotaxa_instances:
     *   get:
     *     summary: List EcoTaxa instances
     *     description: Returns all registered EcoTaxa instances.
     *     tags: [EcoTaxa Instances]
     *     responses:
     *       200:
     *         description: List of EcoTaxa instances.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/EcotaxaInstance'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Get all EcoTaxa instances
    router.get('/', async (req: Request, res: Response) => {
        try {
            const instances = await getAllEcoTaxaInstancesUseCase.execute();
            res.status(200).send(instances)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            res.status(500).send({ errors: ["Cannot get EcoTaxa instances"] })
        }
    })

    /**
     * @openapi
     * /ecotaxa_instances:
     *   post:
     *     summary: Create EcoTaxa instance
     *     description: Create a new EcoTaxa instance (admin only).
     *     tags: [EcoTaxa Instances]
     *     security:
     *       - cookieAccessToken: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/EcotaxaInstanceRequestCreation'
     *     responses:
     *       201:
     *         description: EcoTaxa instance created.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/EcotaxaInstance'
     *       401:
     *         description: Logged user cannot create an EcoTaxa instance.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User is deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Create a new EcoTaxa instance (admin only)
    router.post('/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const instance = await createEcoTaxaInstanceUseCase.execute((req as CustomRequest).token, req.body);
            res.status(201).send(instance)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot create an EcoTaxa instance") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot create EcoTaxa instance"] })
        }
    })

    return router
}
