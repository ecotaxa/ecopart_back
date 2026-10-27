import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareNotificationValidation } from '../middleware/notification-validation'

import { GetNotificationsUseCase } from '../../domain/interfaces/use-cases/notification/get-notifications'
import { CountUnreadNotificationsUseCase } from '../../domain/interfaces/use-cases/notification/count-unread-notifications'
import { MarkNotificationReadUseCase } from '../../domain/interfaces/use-cases/notification/mark-notification-read'
import { MarkAllNotificationsReadUseCase } from '../../domain/interfaces/use-cases/notification/mark-all-notifications-read'
import { DeleteNotificationUseCase } from '../../domain/interfaces/use-cases/notification/delete-notification'
import { CustomRequest } from '../../domain/entities/auth'

export default function NotificationRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareNotificationValidation: IMiddlewareNotificationValidation,
    getNotificationsUseCase: GetNotificationsUseCase,
    countUnreadNotificationsUseCase: CountUnreadNotificationsUseCase,
    markNotificationReadUseCase: MarkNotificationReadUseCase,
    markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    deleteNotificationUseCase: DeleteNotificationUseCase,
) {
    const router = express.Router()

    /**
     * @openapi
     * /notifications:
     *   get:
     *     summary: Notifications of the logged user
     *     description: |
     *       Returns a page of the notifications addressed to the logged user, newest first, with the
     *       number of unread ones. Notifications are created by the server, e.g. when a task of the
     *       user ends.
     *     tags: [Notifications]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
     *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
     *       - { in: query, name: unread_only, schema: { type: boolean, default: false } }
     *     responses:
     *       200:
     *         description: A page of notifications.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/NotificationList'
     *       401:
     *         description: Not authenticated.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: Authenticated user is not allowed (account cannot be used).
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.get('/', middlewareAuth.auth, middlewareNotificationValidation.rulesGetNotifications, async (req: Request, res: Response) => {
        try {
            const result = await getNotificationsUseCase.execute((req as CustomRequest).token, {
                page: req.query.page as unknown as number,
                limit: req.query.limit as unknown as number,
                unread_only: req.query.unread_only as unknown as boolean,
            })
            res.status(200).send(result)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get notifications"] })
        }
    })

    /**
     * @openapi
     * /notifications/unread_count:
     *   get:
     *     summary: Number of unread notifications of the logged user
     *     description: Lightweight endpoint polled by the front-end to badge the notification bell.
     *     tags: [Notifications]
     *     security:
     *       - cookieAccessToken: []
     *     responses:
     *       200:
     *         description: The number of unread notifications.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/NotificationUnreadCount'
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
    router.get('/unread_count', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const unread_count = await countUnreadNotificationsUseCase.execute((req as CustomRequest).token)
            res.status(200).send({ unread_count })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot count unread notifications"] })
        }
    })

    /**
     * @openapi
     * /notifications/read:
     *   post:
     *     summary: Mark every notification of the logged user as read
     *     tags: [Notifications]
     *     security:
     *       - cookieAccessToken: []
     *     responses:
     *       200:
     *         description: The notifications were marked as read.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 marked_read: { type: integer, description: Notifications that were unread, example: 3 }
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
    router.post('/read', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const marked_read = await markAllNotificationsReadUseCase.execute((req as CustomRequest).token)
            res.status(200).send({ marked_read })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot mark notifications as read"] })
        }
    })

    /**
     * @openapi
     * /notifications/{notification_id}/read:
     *   post:
     *     summary: Mark one notification as read
     *     tags: [Notifications]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - { in: path, name: notification_id, required: true, schema: { type: integer, minimum: 1 } }
     *     responses:
     *       200:
     *         description: The notification is read.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message: { type: string, example: Notification marked as read }
     *       401:
     *         description: Not authenticated.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: Authenticated user is not allowed (account cannot be used).
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       404:
     *         description: No notification with this id for the logged user.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.post('/:notification_id/read', middlewareAuth.auth, middlewareNotificationValidation.rulesNotificationId, async (req: Request, res: Response) => {
        try {
            await markNotificationReadUseCase.execute((req as CustomRequest).token, req.params.notification_id as unknown as number)
            res.status(200).send({ message: "Notification marked as read" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Notification not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot mark notification as read"] })
        }
    })

    /**
     * @openapi
     * /notifications/{notification_id}:
     *   delete:
     *     summary: Delete one notification
     *     tags: [Notifications]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - { in: path, name: notification_id, required: true, schema: { type: integer, minimum: 1 } }
     *     responses:
     *       200:
     *         description: The notification was deleted.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message: { type: string, example: Notification deleted }
     *       401:
     *         description: Not authenticated.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       403:
     *         description: Authenticated user is not allowed (account cannot be used).
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       404:
     *         description: No notification with this id for the logged user.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     *       422:
     *         description: Validation error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } } }
     *       500:
     *         description: Internal server error.
     *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
     */
    router.delete('/:notification_id', middlewareAuth.auth, middlewareNotificationValidation.rulesNotificationId, async (req: Request, res: Response) => {
        try {
            await deleteNotificationUseCase.execute((req as CustomRequest).token, req.params.notification_id as unknown as number)
            res.status(200).send({ message: "Notification deleted" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Notification not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete notification"] })
        }
    })

    return router
}
