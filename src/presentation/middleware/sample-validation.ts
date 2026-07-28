import { NextFunction, Request, Response } from 'express';
import { validationResult, query, body } from 'express-validator';
//check
import { IMiddlewareSampleValidation } from '../interfaces/middleware/sample-validation';


export class MiddlewareSampleValidation implements IMiddlewareSampleValidation {
    rulesGetSamples = [
        query('page').default(1)
            .isInt({ min: 1 }).withMessage('Page must be a number and must be greater than 0.'),
        query('limit').default(10)
            .isInt({ min: 1 }).withMessage('Limit must be a number and must be greater than 0.'),
        query('sort_by').default("asc(sample_id)"),
        // DO NOT WORK .isString().withMessage('Sort_by must be a string formatted as follow : desc(field1),asc(field2),desc(field3),...'),
        // Error Handling Middleware
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Centralized error handling for validation errors
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];

    rulesSetVisualQc = [
        body('visual_qc_status_label')
            .isString().bail()
            .isIn(['VALIDATED', 'REJECTED']).withMessage('visual_qc_status_label must be VALIDATED or REJECTED.'),
        body('comment').optional({ nullable: true })
            .isString().withMessage('comment must be a string.'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];

    rulesPreviewQcGraphs = [
        body('sample_names')
            .exists().withMessage('sample_names are required.').bail()
            .isArray({ min: 1 }).withMessage('sample_names must be a non-empty array.'),
        body('sample_names.*')
            .isString().withMessage('Each sample name must be a string.'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];

}
