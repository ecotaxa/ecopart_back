import { NextFunction, Request, Response } from 'express';
import { check, validationResult } from 'express-validator';

const ALLOWED_EXPORT_TYPES = ["metadata", "lpm", "ctd", "ecotaxa"];

export interface IMiddlewareExportValidation {
    rulesExportRawData: any[];
}

export class MiddlewareExportValidation implements IMiddlewareExportValidation {
    rulesExportRawData = [
        check("sample_ids")
            .exists().withMessage('sample_ids is required.')
            .isArray({ min: 1 }).withMessage('sample_ids must be a non-empty array.'),
        check("sample_ids.*")
            .isInt({ gt: 0 }).withMessage('sample_ids must contain positive integers.'),
        check("export_types")
            .exists().withMessage('export_types is required.')
            .isArray({ min: 1 }).withMessage('export_types must be a non-empty array.'),
        check("export_types.*")
            .isIn(ALLOWED_EXPORT_TYPES).withMessage(`export_types must each be one of: ${ALLOWED_EXPORT_TYPES.join(", ")}.`),
        check("ecotaxa_exclude_not_living")
            .if((_value: any, { req }: any) => Array.isArray(req.body?.export_types) && req.body.export_types.includes("ecotaxa"))
            .exists().withMessage('ecotaxa_exclude_not_living is required when ecotaxa export is selected.')
            .isBoolean().withMessage('ecotaxa_exclude_not_living must be a boolean.'),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];
}
