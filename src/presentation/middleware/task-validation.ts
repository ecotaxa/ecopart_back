import { NextFunction, Request, Response } from 'express';
import { validationResult, query } from 'express-validator';
import { IMiddlewareTaskValidation } from '../interfaces/middleware/task-validation';

export class MiddlewareTaskValidation implements IMiddlewareTaskValidation {
    rulesGetTasks = [
        query('page').default(1)
            .isInt({ min: 1 }).withMessage('Page must be a number and must be greater than 0.'),
        query('limit').default(10)
            .isInt({ min: 1 }).withMessage('Limit must be a number and must be greater than 0.'),
        query('sort_by').default("asc(user_id)"),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Centralized error handling for validation errors
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];
}
