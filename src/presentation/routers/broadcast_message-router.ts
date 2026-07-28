import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareBroadcastMessageValidation } from '../middleware/broadcast_message-validation'

import { GetBroadcastMessageUseCase } from '../../domain/interfaces/use-cases/broadcast_message/get-broadcast-message'
import { SetBroadcastMessageUseCase } from '../../domain/interfaces/use-cases/broadcast_message/set-broadcast-message'
import { DeleteBroadcastMessageUseCase } from '../../domain/interfaces/use-cases/broadcast_message/delete-broadcast-message'
import { CustomRequest } from '../../domain/entities/auth'
import { BroadcastMessageRequestCreationModel } from '../../domain/entities/broadcast_message'

export default function BroadcastMessageRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareBroadcastMessageValidation: IMiddlewareBroadcastMessageValidation,
    getBroadcastMessageUseCase: GetBroadcastMessageUseCase,
    setBroadcastMessageUseCase: SetBroadcastMessageUseCase,
    deleteBroadcastMessageUseCase: DeleteBroadcastMessageUseCase,
) {
    const router = express.Router()

    /**
     * @openapi
     * /broadcast_messages:
     *   get:
     *     summary: Current broadcast message
     *     description: |
     *       Returns the single application-wide broadcast message currently set, or `null` when
     *       none is set. Readable by any authenticated user — the front-end displays it to everyone.
     *     tags: [Broadcast Messages]
     *     security:
     *       - cookieAccessToken: []
     *     responses:
     *       200:
     *         description: The current broadcast message, or null.
     *         content:
     *           application/json:
     *             schema:
     *               oneOf:
     *                 - $ref: '#/components/schemas/BroadcastMessage'
     *                 - type: 'null'
     *       401:
     *         description: Not authenticated.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: Authenticated user is not allowed (account cannot be used).
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.get('/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const message = await getBroadcastMessageUseCase.execute((req as CustomRequest).token)
            res.status(200).send(message)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get broadcast message"] })
        }
    })

    /**
     * @openapi
     * /broadcast_messages:
     *   post:
     *     summary: Set the broadcast message (admin only)
     *     description: |
     *       Sets or replaces the single application-wide broadcast message. Reserved to administrators.
     *       The application holds only one message at a time, so this overwrites any existing one.
     *     tags: [Broadcast Messages]
     *     security:
     *       - cookieAccessToken: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/BroadcastMessageInput'
     *     responses:
     *       201:
     *         description: The broadcast message that was set.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/BroadcastMessage'
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
    router.post('/', middlewareAuth.auth, middlewareBroadcastMessageValidation.rulesSetMessage, async (req: Request, res: Response) => {
        try {
            const input: BroadcastMessageRequestCreationModel = {
                message: req.body.message,
                sub_message: req.body.sub_message ?? null,
                level: req.body.level,
            }
            const message = await setBroadcastMessageUseCase.execute((req as CustomRequest).token, input)
            res.status(201).send(message)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot manage broadcast messages") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot set broadcast message"] })
        }
    })

    /**
     * @openapi
     * /broadcast_messages:
     *   delete:
     *     summary: Delete the broadcast message (admin only)
     *     description: |
     *       Clears the single application-wide broadcast message. Reserved to administrators.
     *       Succeeds even if no message is currently set.
     *     tags: [Broadcast Messages]
     *     security:
     *       - cookieAccessToken: []
     *     responses:
     *       200:
     *         description: The broadcast message was cleared.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message: { type: string, example: Broadcast message deleted }
     *       401:
     *         description: Not authenticated.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: Authenticated user is not allowed (not an admin, or account cannot be used).
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.delete('/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteBroadcastMessageUseCase.execute((req as CustomRequest).token)
            res.status(200).send({ message: "Broadcast message deleted" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot manage broadcast messages") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete broadcast message"] })
        }
    })

    return router
}
