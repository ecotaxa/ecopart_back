import { NextFunction, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';

export interface IMiddlewareAdminValidation {
    rulesGetStats: any[];
}

export class MiddlewareAdminValidation implements IMiddlewareAdminValidation {
    rulesGetStats = [
        query('from')
            .optional()
            .isISO8601().withMessage('from must be an ISO 8601 date.'),
        query('to')
            .optional()
            .isISO8601().withMessage('to must be an ISO 8601 date.'),
        query('granularity')
            .optional()
            .isIn(['day', 'week', 'month']).withMessage('granularity must be one of: day, week, month.'),
        query('include_storage')
            .optional()
            .isBoolean().withMessage('include_storage must be a boolean.'),
        // ISO date strings compare chronologically as plain strings.
        query('to')
            .optional()
            .custom((to: any, { req }: any) => {
                const from = req.query?.from;
                if (from && to && String(from) > String(to)) {
                    throw new Error('from must be earlier than or equal to to.');
                }
                return true;
            }),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];
}
