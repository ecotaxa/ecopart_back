import { NextFunction, Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { BINNED_DEPTH_STEP_M, BINNED_TIME_STEP_H } from '../../domain/constants/binned-export';
import { EXPORT_TABLE_FORMATS } from '../../domain/constants/export-format';

const ALLOWED_EXPORT_TYPES = ["metadata", "lpm", "images", "instrument_config", "ctd", "ecotaxa"];
const ALLOWED_BIN_MODES = ["auto", "depth", "time"];

export interface IMiddlewareExportValidation {
    rulesExportRawData: any[];
    rulesExportBinnedData: any[];
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
        check("skip_not_validated")
            .optional()
            .isBoolean().withMessage('skip_not_validated must be a boolean.'),
        check("format")
            .optional()
            .isIn(EXPORT_TABLE_FORMATS).withMessage(`format must be one of: ${EXPORT_TABLE_FORMATS.join(", ")}.`),
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

    rulesExportBinnedData = [
        check("sample_ids")
            .exists().withMessage('sample_ids is required.')
            .isArray({ min: 1 }).withMessage('sample_ids must be a non-empty array.'),
        check("sample_ids.*")
            .isInt({ gt: 0 }).withMessage('sample_ids must contain positive integers.'),
        check("bin_mode")
            .optional()
            .isIn(ALLOWED_BIN_MODES).withMessage(`bin_mode must be one of: ${ALLOWED_BIN_MODES.join(", ")}.`),
        check("bin_size_m")
            .optional()
            .isFloat({ min: BINNED_DEPTH_STEP_M.min, max: BINNED_DEPTH_STEP_M.max }).withMessage(`bin_size_m must be a number between ${BINNED_DEPTH_STEP_M.min} and ${BINNED_DEPTH_STEP_M.max}.`),
        check("bin_size_h")
            .optional()
            .isFloat({ min: BINNED_TIME_STEP_H.min, max: BINNED_TIME_STEP_H.max }).withMessage(`bin_size_h must be a number between ${BINNED_TIME_STEP_H.min} and ${BINNED_TIME_STEP_H.max}.`),
        // isBoolean also accepts the strings "true"/"false"/"1"/"0": converted here, the string
        // "false" cannot turn the gate opt-out on.
        check("skip_not_validated")
            .optional()
            .isBoolean().withMessage('skip_not_validated must be a boolean.')
            .toBoolean(),
        check("format")
            .optional()
            .isIn(EXPORT_TABLE_FORMATS).withMessage(`format must be one of: ${EXPORT_TABLE_FORMATS.join(", ")}.`),
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ];
}
