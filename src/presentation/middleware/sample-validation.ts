import { NextFunction, Request, Response } from 'express';
import { validationResult, query } from 'express-validator';
//check
import { IMiddlewareSampleValidation } from '../interfaces/middleware/sample-validation';


export class MiddlewareSampleValidation implements IMiddlewareSampleValidation {
    // rulesSampleRequestCreationModel = [
    //     // Root Folder Path Validation
    //     check('root_folder_path')
    //         .trim()
    //         .not().isEmpty().withMessage('Root Folder Path is required.'),

    //     // Sample Title Validation
    //     check('sample_title')
    //         .trim()
    //         .not().isEmpty().withMessage('Sample title is required.'),

    //     // Sample acrony Validation
    //     check('sample_acronym')
    //         .trim()
    //         .not().isEmpty().withMessage('Sample acronym is required.'),

    //     // Sample description Validation
    //     check('sample_description')
    //         .trim()
    //         .not().isEmpty().withMessage('Sample description is required.'),

    //     // Sample information Validation
    //     check('sample_information')
    //         .trim()
    //         .not().isEmpty().withMessage('Sample information is required.'),

    //     // Sample cruise Validation
    //     check('cruise')
    //         .trim()
    //         .not().isEmpty().withMessage('Cruise name is required.'),

    //     // Sample ship Validation 
    //     check('ship').trim()
    //         .not().isEmpty().withMessage('Ship name is required.'),

    //     // Data owner name Validation
    //     check('data_owner_name')
    //         .trim()
    //         .not().isEmpty().withMessage('Data owner name is required.'),

    //     //  Data owner email Validation
    //     check('data_owner_email').exists().withMessage('Data owner email is required.')
    //         .trim()
    //         .normalizeEmail()
    //         .isEmail().withMessage('Data owner email must be a valid email address.')
    //         .bail(),

    //     // Operator name Validation
    //     check('operator_name')
    //         .trim()
    //         .not().isEmpty().withMessage('Operator name is required.'),

    //     // Operator email Validation
    //     check('operator_email').exists().withMessage('Operator email is required.')
    //         .trim()
    //         .normalizeEmail()
    //         .isEmail().withMessage('Operator email must be a valid email address.')
    //         .bail(),

    //     // Chief scientist name Validation
    //     check('chief_scientist_name')
    //         .trim()
    //         .not().isEmpty().withMessage('Chief scientist name is required.'),

    //     // Chief scientist email Validation
    //     check('chief_scientist_email').exists().withMessage('Chief scientist email is required.')
    //         .trim()
    //         .normalizeEmail()
    //         .isEmail().withMessage('Chief scientist email must be a valid email address.')
    //         .bail(),

    //     // Override depth offset Validation 
    //     check('override_depth_offset').optional()
    //         .isFloat().withMessage('Override depth offset must be a float value.'),

    //     // Enable descent filter Validation
    //     check('enable_descent_filter')
    //         .exists().withMessage('Enable descent filter is required.')
    //         .isBoolean().withMessage('Enable descent filter must be a boolean value.'),

    //     // Privacy duration Validation
    //     check('privacy_duration').default(2)
    //         .isInt({ min: 0 }).withMessage('Privacy duration must be a number and must be greater than 0.'),

    //     // Visible duration Validation 
    //     check('visible_duration').default(24)
    //         .isInt({ min: 0 }).withMessage('Visible duration must be a number and must be greater than 0.'),

    //     // Public duration Validation 
    //     check('public_duration').default(36)
    //         .isInt({ min: 0 }).withMessage('Public duration must be a number and must be greater than 0.'),

    //     // Instrument Validation 
    //     check('instrument_model')
    //         .exists().withMessage('Instrument model is required.')
    //         .isString()
    //         .isIn(['UVP5HD', 'UVP5SD', 'UVP5Z', 'UVP6LP', 'UVP6HF', 'UVP6MHP', 'UVP6MHF'])
    //         .withMessage("Instrument model must be a string included in the following list of instrument models: ['UVP5HD', 'UVP5SD', 'UVP5Z', 'UVP6LP', 'UVP6HF', 'UVP6MHP', 'UVP6MHF']"),
    //     // Serial number Validation
    //     check('serial_number').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Serial number is required.'),
    //     // Sample contact Validation
    //     check('contact')
    //         .exists().withMessage('Contact is required.')
    //         .isObject().withMessage('Contact must be an object.')
    //         .bail()
    //         .custom((value: any) => {
    //             if (value.user_id === undefined) {
    //                 throw new Error('Contact user_id is required.');
    //             }
    //             return true;
    //         }),
    //     // Sample members Validation 
    //     check('members')
    //         .exists().withMessage('Members are required.')
    //         .isArray().withMessage('Members must be an array.')
    //         .bail()
    //         .custom((value: any) => {
    //             if (value.length > 0) {
    //                 for (const member of value) {
    //                     if (member.user_id === undefined) {
    //                         throw new Error('Member user_id is required.');
    //                     }
    //                 }
    //             }
    //             return true;
    //         }),
    //     // Sample managers Validation 
    //     check('managers')
    //         .exists().withMessage('Managers are required.')
    //         .isArray().withMessage('Managers must be an array.')
    //         .bail()
    //         .custom((value: any) => {
    //             if (value.length === 0) {
    //                 throw new Error('At least one user must be a manager');
    //             }
    //             for (const manager of value) {
    //                 if (manager.user_id === undefined) {
    //                     throw new Error('Manager user_id is required.');
    //                 }
    //             }
    //             return true;
    //         }),


    //     // Error Handling Middleware
    //     (req: Request, res: Response, next: NextFunction) => {
    //         const errors = validationResult(req);
    //         if (!errors.isEmpty()) {
    //             // Centralized error handling for validation errors
    //             return res.status(422).json({ errors: errors.array() });
    //         }
    //         next();
    //     },
    // ];

    // rulesSampleUpdateModel = [
    //     // Root Folder Path Validation
    //     check('root_folder_path').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Root Folder Path value cannot be empty.'),
    //     // Sample Title Validation
    //     check('sample_title').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Sample title cannot be empty.'),
    //     // Sample acrony Validation
    //     check('sample_acronym').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Sample acronym cannot be empty.'),
    //     // Sample description Validation
    //     check('sample_description').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Sample description cannot be empty.'),
    //     // Sample information Validation
    //     check('sample_information').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Sample information cannot be empty.'),

    //     // Sample cruise Validation
    //     check('cruise').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Cruise name cannot be empty.'),

    //     // Sample ship Validation 
    //     check('ship').optional().trim()
    //         .not().isEmpty().withMessage('Ship name cannot be empty.'),

    //     // Data owner name Validation
    //     check('data_owner_name').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Data owner name cannot be empty.'),

    //     //  Data owner email Validation
    //     check('data_owner_email').optional()
    //         .trim()
    //         .normalizeEmail()
    //         .isEmail().withMessage('Data owner email must be a valid email address.')
    //         .bail(),

    //     // Operator name Validation
    //     check('operator_name').optional()
    //         .trim(),
    //     // Operator email Validation
    //     check('operator_email').optional()
    //         .trim()
    //         .normalizeEmail()
    //         .isEmail().withMessage('Operator email must be a valid email address.')
    //         .bail(),

    //     // Chief scientist name Validation
    //     check('chief_scientist_name').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Chief scientist name cannot be empty.'),

    //     // Chief scientist email Validation
    //     check('chief_scientist_email').optional()
    //         .trim()
    //         .normalizeEmail()
    //         .isEmail().withMessage('Chief scientist email must be a valid email address.')
    //         .bail(),

    //     // Override depth offset Validation 
    //     check('override_depth_offset').optional().optional()
    //         .isFloat().withMessage('Override depth offset must be a float value.'),

    //     // Enable descent filter Validation
    //     check('enable_descent_filter').optional()
    //         .isBoolean().withMessage('Enable descent filter must be a boolean value.'),

    //     // Privacy duration Validation
    //     check('privacy_duration').optional()
    //         .isInt({ min: 0 }).withMessage('Privacy duration must be a number and must be greater than 0.'),

    //     // Visible duration Validation 
    //     check('visible_duration').optional()
    //         .isInt({ min: 0 }).withMessage('Visible duration must be a number and must be greater than 0.'),

    //     // Public duration Validation 
    //     check('public_duration').optional()
    //         .isInt({ min: 0 }).withMessage('Public duration must be a number and must be greater than 0.'),

    //     // Instrument Validation 
    //     check('instrument_model').optional()
    //         .isString()
    //         .isIn(['UVP5HD', 'UVP5SD', 'UVP5Z', 'UVP5Z', 'UVP6LP', 'UVP6HF', 'UVP6MHP', 'UVP6MHF'])
    //         .withMessage("Instrument model must be a string included in the following list of instrument models: ['UVP5HD', 'UVP5SD', 'UVP5Z', 'UVP6LP', 'UVP6HF', 'UVP6MHP', 'UVP6MHF']"),

    //     // Serial number Validation,
    //     check('serial_number').optional()
    //         .trim()
    //         .not().isEmpty().withMessage('Serial number cannot be empty.')
    //     ,
    //     // Sample Creation Date Validation
    //     check('user_creation_date')
    //         .isEmpty().withMessage('Sample creation date cannot be set manually.'),

    //     // Error Handling Middleware
    //     (req: Request, res: Response, next: NextFunction) => {
    //         const errors = validationResult(req);
    //         if (!errors.isEmpty()) {
    //             // Centralized error handling for validation errors
    //             return res.status(422).json({ errors: errors.array() });
    //         }
    //         next();
    //     },
    // ]

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

}
