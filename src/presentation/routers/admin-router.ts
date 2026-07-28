import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareAdminValidation } from '../middleware/admin-validation'

import { GetStatsUseCase } from '../../domain/interfaces/use-cases/admin/get-stats'
import { CustomRequest } from '../../domain/entities/auth'
import { StatsGranularity } from '../../domain/entities/stats'

export default function AdminRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareAdminValidation: IMiddlewareAdminValidation,
    getStatsUseCase: GetStatsUseCase,
) {
    const router = express.Router()

    /**
     * @openapi
     * /admin/stats:
     *   get:
     *     summary: Application statistics (admin only)
     *     description: |
     *       Returns global application statistics in a single call. Reserved to administrators.
     *
     *       The response has two parts:
     *       - `totals`: current point-in-time state — counts of users, projects, tasks (incl. exports),
     *         samples, on-disk storage size, plus breakdowns and health indicators. Ignores the period.
     *       - `period`: activity within the selected `[from, to]` window, including time series for
     *         charts: number of projects created, number of samples created, and stored-data size,
     *         per interval (with a pre-window baseline and running cumulatives).
     *
     *       The window is optional: `from` defaults to the earliest activity date, `to` to now.
     *       Series `interval` keys are `YYYY-MM-DD` (day), `YYYY-WW` (week) or `YYYY-MM` (month) depending
     *       on `granularity` (auto-selected from the span when omitted). Intervals with no activity are
     *       returned with zero values.
     *
     *       On-disk storage sizes are **expensive** (a filesystem walk of every project folder) and are
     *       computed only when `include_storage=true`. Otherwise `totals.storage.total_size_bytes`,
     *       `period.baseline.data_size_bytes` and every `series[].data_size_bytes` /
     *       `series[].cumulative_data_size_bytes` are `null`.
     *     tags: [Admin]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - in: query
     *         name: from
     *         required: false
     *         schema: { type: string, format: date-time }
     *         description: Window start (ISO 8601). Defaults to the earliest activity date.
     *       - in: query
     *         name: to
     *         required: false
     *         schema: { type: string, format: date-time }
     *         description: Window end (ISO 8601). Defaults to now.
     *       - in: query
     *         name: granularity
     *         required: false
     *         schema: { type: string, enum: [day, week, month] }
     *         description: Time-series interval size. Defaults to auto (day ≤ 92d, week ≤ 730d, else month).
     *       - in: query
     *         name: include_storage
     *         required: false
     *         schema: { type: boolean, default: false }
     *         description: Compute on-disk storage sizes (expensive filesystem walk). When false, all data-size fields are null.
     *     responses:
     *       200:
     *         description: Application statistics.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AdminStats'
     *       401:
     *         description: Not authenticated.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: Authenticated user is not allowed (not an admin, or account cannot be used).
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.get('/stats', middlewareAuth.auth, middlewareAdminValidation.rulesGetStats, async (req: Request, res: Response) => {
        try {
            const from = typeof req.query.from === 'string' ? req.query.from : undefined;
            const to = typeof req.query.to === 'string' ? req.query.to : undefined;
            const granularity = typeof req.query.granularity === 'string' ? (req.query.granularity as StatsGranularity) : undefined;
            const include_storage = req.query.include_storage === 'true' || req.query.include_storage === '1';

            const stats = await getStatsUseCase.execute((req as CustomRequest).token, { from, to, granularity, include_storage });
            res.status(200).send(stats)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot access statistics") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get statistics"] })
        }
    })

    return router
}
