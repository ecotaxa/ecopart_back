import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareExploreValidation } from '../middleware/explore-validation'
import { CustomRequest } from '../../domain/entities/auth'
import { ListExploreProjectsUseCase } from '../../domain/interfaces/use-cases/explore/list-explore-projects'
import { GetExploreMapUseCase } from '../../domain/interfaces/use-cases/explore/get-explore-map'
import { GetExploreSelectionUseCase } from '../../domain/interfaces/use-cases/explore/get-explore-selection'
import { GetExploreEcoTaxaUseCase } from '../../domain/interfaces/use-cases/explore/get-explore-ecotaxa'
import { GetExploreImagesUseCase } from '../../domain/interfaces/use-cases/explore/get-explore-images'
import { GetExploreGraphsUseCase } from '../../domain/interfaces/use-cases/explore/get-explore-graphs'

// The user behind an optionally authenticated request: null when anonymous.
const userOf = (req: Request) => (req as CustomRequest).token ?? null;

export default function ExploreRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareExploreValidation: IMiddlewareExploreValidation,
    listExploreProjectsUseCase: ListExploreProjectsUseCase,
    getExploreMapUseCase: GetExploreMapUseCase,
    getExploreSelectionUseCase: GetExploreSelectionUseCase,
    getExploreEcoTaxaUseCase: GetExploreEcoTaxaUseCase,
    getExploreImagesUseCase: GetExploreImagesUseCase,
    getExploreGraphsUseCase: GetExploreGraphsUseCase,
) {
    const router = express.Router()

    const sendError = (res: Response, err: any, fallback: string) => {
        console.log(new Date().toISOString(), err)
        const msg: string = err?.message || "";
        if (msg === "User cannot be used") res.status(403).send({ errors: [msg] })
        else if (msg === "Login required") res.status(401).send({ errors: [msg] })
        else if (msg.startsWith("pressure_bin must") || msg.startsWith("time_bin must") || msg.startsWith("count must") || msg.startsWith("mode must")) res.status(422).send({ errors: [msg] })
        else res.status(500).send({ errors: [fallback] })
    }

    /**
     * @openapi
     * /explore/projects:
     *   get:
     *     summary: Projects offered by the Explore project criterion
     *     description: |
     *       Every project of the application with its number of samples, for the project filter of the
     *       Explore page. Anonymous callers are served too: the specification lets anyone see that a
     *       project exists, so that access can be requested.
     *     tags: [Explore]
     *     security:
     *       - cookieAccessToken: []
     *       - {}
     *     responses:
     *       200:
     *         description: The projects.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 projects:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/ExploreProjectOption' }
     *       401:
     *         description: The access cookie is invalid or expired (an absent cookie is accepted).
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: The logged user cannot be used.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.get('/projects', middlewareAuth.auth_optional, async (req: Request, res: Response) => {
        try {
            res.status(200).send({ projects: await listExploreProjectsUseCase.execute(userOf(req)) })
        } catch (err) {
            sendError(res, err, "Cannot list the explore projects")
        }
    })

    /**
     * @openapi
     * /explore/map:
     *   post:
     *     summary: Samples of the Explore selection, for the map
     *     description: |
     *       One point per sample matching the criteria (every sample of the application when `filters`
     *       is null), with its project's privacy status. `mode` selects the sample type: depth profiles
     *       or time series. Anonymous callers are served.
     *     tags: [Explore]
     *     security:
     *       - cookieAccessToken: []
     *       - {}
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ExploreRequest' }
     *     responses:
     *       200:
     *         description: The samples to draw.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 samples:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/ExploreMapSample' }
     *       401:
     *         description: The access cookie is invalid or expired.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: The logged user cannot be used.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.post('/map', middlewareAuth.auth_optional, middlewareExploreValidation.rulesExploreRequest, async (req: Request, res: Response) => {
        try {
            res.status(200).send({ samples: await getExploreMapUseCase.execute(userOf(req), { mode: req.body.mode, filters: req.body.filters ?? null }) })
        } catch (err) {
            sendError(res, err, "Cannot get the explore map")
        }
    })

    /**
     * @openapi
     * /explore/selection:
     *   post:
     *     summary: Statistics and projects of the Explore selection
     *     description: |
     *       The "Selected data stats" tab (`all`: every matching sample, private projects included) and
     *       the "Exportable selection" tab (`exportable`: the samples the caller may export, that is
     *       samples with a validated visual QC whose project is public or open, or of which the caller
     *       is a member or a manager; always empty for an anonymous caller). Contact and manager
     *       e-mails are only served to logged-in callers. The EcoTaxa part of the tabs is served by
     *       `/explore/ecotaxa`.
     *     tags: [Explore]
     *     security:
     *       - cookieAccessToken: []
     *       - {}
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ExploreRequest' }
     *     responses:
     *       200:
     *         description: The two selections.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ExploreSelectionResponse' }
     *       401:
     *         description: The access cookie is invalid or expired.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: The logged user cannot be used.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.post('/selection', middlewareAuth.auth_optional, middlewareExploreValidation.rulesExploreRequest, async (req: Request, res: Response) => {
        try {
            res.status(200).send(await getExploreSelectionUseCase.execute(userOf(req), { mode: req.body.mode, filters: req.body.filters ?? null }))
        } catch (err) {
            sendError(res, err, "Cannot get the explore selection")
        }
    })

    /**
     * @openapi
     * /explore/ecotaxa:
     *   post:
     *     summary: EcoTaxa categories and classification state of the Explore selection
     *     description: |
     *       For the samples imported in EcoTaxa, through the generic EcoTaxa account of each instance:
     *       the categories used (display names, the non-living ones left out when
     *       `filters.ecotaxa_exclude_not_living`) and the share of samples fully or partially validated
     *       or predicted. Samples whose EcoTaxa instance does not answer are left out.
     *     tags: [Explore]
     *     security:
     *       - cookieAccessToken: []
     *       - {}
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ExploreRequest' }
     *     responses:
     *       200:
     *         description: The EcoTaxa summaries of the two selections.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ExploreEcoTaxaResponse' }
     *       401:
     *         description: The access cookie is invalid or expired.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: The logged user cannot be used.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.post('/ecotaxa', middlewareAuth.auth_optional, middlewareExploreValidation.rulesExploreRequest, async (req: Request, res: Response) => {
        try {
            res.status(200).send(await getExploreEcoTaxaUseCase.execute(userOf(req), { mode: req.body.mode, filters: req.body.filters ?? null }))
        } catch (err) {
            sendError(res, err, "Cannot get the explore EcoTaxa summary")
        }
    })

    /**
     * @openapi
     * /explore/images:
     *   post:
     *     summary: Random object images of the Explore selection
     *     description: |
     *       `count` (default 4, at most 12) objects drawn at random among random samples of the
     *       selection imported in EcoTaxa, with the URL of their image on the EcoTaxa instance. Call
     *       again for another draw.
     *     tags: [Explore]
     *     security:
     *       - cookieAccessToken: []
     *       - {}
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ExploreImagesRequest' }
     *     responses:
     *       200:
     *         description: The images.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 images:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/ExploreImage' }
     *       401:
     *         description: The access cookie is invalid or expired.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: The logged user cannot be used.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.post('/images', middlewareAuth.auth_optional, middlewareExploreValidation.rulesExploreImages, async (req: Request, res: Response) => {
        try {
            res.status(200).send({ images: await getExploreImagesUseCase.execute(userOf(req), { mode: req.body.mode, filters: req.body.filters ?? null, count: req.body.count ?? undefined }) })
        } catch (err) {
            sendError(res, err, "Cannot get the explore images")
        }
    })

    /**
     * @openapi
     * /explore/graphs:
     *   post:
     *     summary: Curves of the Explore selection
     *     description: |
     *       Particle abundance and biovolume per reduced size class, and the CTD variables, of every
     *       sample of the selection whose project lets the caller see figures (members and managers
     *       always, anyone once the project is visible), binned on the depth axis (`mode: depth`,
     *       `pressure_bin` metres) or on the time axis (`mode: time`, `time_bin` hours) with the binned
     *       export computation, the descent filter of the project applied to depth profiles. At most
     *       100 samples are drawn; `warnings` tells what was left out. Login required.
     *     tags: [Explore]
     *     security:
     *       - cookieAccessToken: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/ExploreGraphsRequest' }
     *     responses:
     *       200:
     *         description: The datasets.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ExploreGraphs' }
     *       401:
     *         description: Not authenticated.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: The logged user cannot be used.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.post('/graphs', middlewareAuth.auth, middlewareExploreValidation.rulesExploreGraphs, async (req: Request, res: Response) => {
        try {
            res.status(200).send(await getExploreGraphsUseCase.execute(userOf(req), {
                mode: req.body.mode, filters: req.body.filters ?? null,
                pressure_bin: req.body.pressure_bin ?? undefined, time_bin: req.body.time_bin ?? undefined,
            }))
        } catch (err) {
            sendError(res, err, "Cannot get the explore graphs")
        }
    })

    return router
}
