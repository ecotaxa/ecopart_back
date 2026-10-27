import { NextFunction, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';

export interface IMiddlewareNotificationValidation {
    rulesGetNotifications: any[];
    rulesNotificationId: any[];
}

const sendValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
};

export class MiddlewareNotificationValidation implements IMiddlewareNotificationValidation {
    rulesGetNotifications = [
        query('page').default(1)
            .isInt({ min: 1 }).withMessage('Page must be a number and must be greater than 0.')
            .toInt(),
        query('limit').default(10)
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be a number between 1 and 100.')
            .toInt(),
        query('unread_only').default(false)
            .isBoolean().withMessage('unread_only must be a boolean.')
            .toBoolean(),
        sendValidationErrors,
    ];

    rulesNotificationId = [
        param('notification_id')
            .isInt({ min: 1 }).withMessage('Notification id must be a number and must be greater than 0.')
            .toInt(),
        sendValidationErrors,
    ];
}
