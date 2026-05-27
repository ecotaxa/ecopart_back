import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareExportValidation } from '../middleware/export-validation'

import { ExportRawDataUseCase } from '../../domain/interfaces/use-cases/export/export-raw-data'
import { CustomRequest } from '../../domain/entities/auth'

export default function ExportRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareExportValidation: IMiddlewareExportValidation,
    exportRawDataUseCase: ExportRawDataUseCase,
) {
    const router = express.Router()

    /**
     * @openapi
     * /exports/raw:
     *   post:
     *     summary: Export raw data for a list of samples (possibly across multiple projects)
     *     description: |
     *       Creates an asynchronous task that bundles the requested raw artifacts for the given samples into a single ZIP.
     *       Supported export types (one or more): `metadata` (projects + samples CSV), `lpm` (particle raw files as imported,
     *       different files for UVP5 vs UVP6), `ctd` (CTD files as imported), `ecotaxa` (EcoTaxa general export TSV via
     *       EcoTaxa's `/object_set/{id}/export/general` API). When `ecotaxa` is selected, `ecotaxa_exclude_not_living=true`
     *       restricts the EcoTaxa export to descendants of the biota taxon (taxo=1, taxochild=Y).
     *
     *       The endpoint returns the created task immediately; the resulting ZIP is downloadable at
     *       `/api/tasks/{task_id}/file` once the task reaches the `DONE` status.
     *     tags: [Exports]
     *     security:
     *       - cookieAccessToken: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [sample_ids, export_types]
     *             properties:
     *               sample_ids:
     *                 type: array
     *                 items: { type: integer }
     *               export_types:
     *                 type: array
     *                 items:
     *                   type: string
     *                   enum: [metadata, lpm, ctd, ecotaxa]
     *               ecotaxa_exclude_not_living:
     *                 type: boolean
     *                 description: Required only when "ecotaxa" is included in export_types.
     *     responses:
     *       200:
     *         description: Task created. Poll the task and download the file once done.
     *       401:
     *         description: User not authorized for one of the projects.
     *       403:
     *         description: User cannot be used.
     *       404:
     *         description: Sample or project not found.
     *       422:
     *         description: Validation error.
     *       500:
     *         description: Internal server error.
     */
    router.post('/raw', middlewareAuth.auth, middlewareExportValidation.rulesExportRawData, async (req: Request, res: Response) => {
        try {
            const task = await exportRawDataUseCase.execute((req as CustomRequest).token, {
                sample_ids: req.body.sample_ids,
                export_types: req.body.export_types,
                ecotaxa_exclude_not_living: req.body.ecotaxa_exclude_not_living,
            });
            res.status(200).send(task)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            const msg: string = err?.message || "";
            if (msg === "User cannot be used") res.status(403).send({ errors: [msg] })
            else if (msg.startsWith("Logged user cannot export raw data")) res.status(401).send({ errors: [msg] })
            else if (msg === "Cannot find project" || msg === "No samples found" || msg.startsWith("Sample(s) not found")) res.status(404).send({ errors: [msg] })
            else if (msg === "Task type not found" || msg === "Task status not found" || msg === "Cannot find task" || msg === "Task not found") res.status(404).send({ errors: [msg] })
            else if (msg === "Cannot create log file") res.status(500).send({ errors: [msg] })
            else res.status(500).send({ errors: ["Cannot export raw data"] })
        }
    })

    return router
}
