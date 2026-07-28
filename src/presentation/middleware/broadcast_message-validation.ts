import { NextFunction, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { MessageLevel } from '../../domain/entities/broadcast_message';

export interface IMiddlewareBroadcastMessageValidation {
    rulesSetMessage: any[];
}

export class MiddlewareBroadcastMessageValidation implements IMiddlewareBroadcastMessageValidation {
    rulesSetMessage = [
        body('message')
            .exists({ checkNull: true }).withMessage('message is required.')
            .bail()
            .isString().withMessage('message must be a string.')
            .bail()
            .trim().notEmpty().withMessage('message cannot be empty.'),
        body('sub_message')
            .optional({ nullable: true })
            .isString().withMessage('sub_message must be a string.'),
        body('level')
            .exists({ checkNull: true }).withMessage('level is required.')
            .bail()
            .isIn(Object.values(MessageLevel)).withMessage(`level must be one of: ${Object.values(MessageLevel).join(', ')}.`),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];
}
