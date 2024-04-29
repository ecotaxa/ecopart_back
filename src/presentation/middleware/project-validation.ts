import { NextFunction, Request, Response } from 'express';
import { check, validationResult, query, oneOf } from 'express-validator';
import { IMiddlewareProjectValidation } from '../interfaces/middleware/project-validation';


export class MiddlewareProjectValidation implements IMiddlewareProjectValidation {
    rulesProjectRequestCreationtModel = [
        // Root Folder Path Validation
        check('root_folder_path')
            .trim()
            .not().isEmpty().withMessage('Root Folder Path is required.'),

        // Project Title Validation
        check('project_title')
            .trim()
            .not().isEmpty().withMessage('Project title is required.'),

        // Project acrony Validation
        check('project_acronym')
            .trim()
            .not().isEmpty().withMessage('Project acronym is required.'),

        // Project description Validation
        check('project_description')
            .trim()
            .not().isEmpty().withMessage('Project description is required.'),

        // Project information Validation
        check('project_information')
            .trim()
            .not().isEmpty().withMessage('Project information is required.'),

        // Project cruise Validation
        check('cruise')
            .trim()
            .not().isEmpty().withMessage('Cruise name is required.'),

        // Project ship Validation 
        check('ship').trim()
            .not().isEmpty().withMessage('Ship name is required.'),

        // Data owner name Validation
        check('data_owner_name')
            .trim()
            .not().isEmpty().withMessage('Data owner name is required.'),

        //  Data owner email Validation
        check('data_owner_email').exists().withMessage('Data owner email is required.')
            .trim()
            .normalizeEmail()
            .isEmail().withMessage('Data owner email must be a valid email address.')
            .bail(),

        // Operator name Validation
        check('operator_name')
            .trim()
            .not().isEmpty().withMessage('Operator name is required.'),

        // Operator email Validation
        check('operator_email').exists().withMessage('Operator email is required.')
            .trim()
            .normalizeEmail()
            .isEmail().withMessage('Operator email must be a valid email address.')
            .bail(),

        // Chief scientist name Validation
        check('chief_scientist_name')
            .trim()
            .not().isEmpty().withMessage('Chief scientist name is required.'),

        // Chief scientist email Validation
        check('chief_scientist_email').exists().withMessage('Chief scientist email is required.')
            .trim()
            .normalizeEmail()
            .isEmail().withMessage('Chief scientist email must be a valid email address.')
            .bail(),

        // Override depth offset Validation 
        check('override_depth_offset').optional()
            .isFloat().withMessage('Override depth offset must be a float value.'),

        // Enable descent filter Validation
        check('enable_descent_filter')
            .exists().withMessage('Enable descent filter is required.')
            .trim()
            .isBoolean().withMessage('Enable descent filter must be a boolean value.'),

        // Privacy duration Validation
        check('privacy_duration').default(2)
            .isInt({ min: 0 }).withMessage('Privacy duration must be a number and must be greater than 0.'),

        // Visible duration Validation 
        check('visible_duration').default(24)
            .isInt({ min: 0 }).withMessage('Visible duration must be a number and must be greater than 0.'),

        // Public duration Validation 
        check('public_duration').default(36)
            .isInt({ min: 0 }).withMessage('Public duration must be a number and must be greater than 0.'),

        // Instrument Validation 
        check('instrument') // TODO next sprin check this is an authorized instrument
            .trim()
            .not().isEmpty().withMessage('Instrument is required.'),

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

    rulesProjectUpdateModel = [
        oneOf([
            // Email Validation
            check('email').exists().withMessage('No value provided.').bail()
                .trim()
                .normalizeEmail()
                .isEmail().withMessage('Email must be a valid email address.'),
            // First Name Validation
            check('first_name').exists().withMessage('No value provided.')
                .trim(),

            // Last Name Validation
            check('last_name').exists().withMessage('No value provided.')
                .trim(),


            // Valid email Validation
            check('valid_email').exists().withMessage('No value provided.')
                .trim(),

            // Is Admin Validation
            check('is_admin').exists().withMessage('No value provided.')
                .trim(),

            // Confirmation Code Validation (optional field)
            check('confirmation_code').exists().withMessage('No value provided.'),

            // Organisation Validation
            check('organisation').exists().withMessage('No value provided.')
                .trim(),

            // Project Planned Usage Validation
            check('user_planned_usage').exists().withMessage('No value provided.')
                .trim(),

        ], { errorType: 'flat', message: 'At least one valid field must be updated.' }),
        // Project Creation Date Validation
        check('user_creation_date')
            .isEmpty().withMessage('Project creation date cannot be set manually.'),
        // Error Handling Middleware
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Centralized error handling for validation errors
                return res.status(422).json({ errors: errors.array() });
            }
            next();
        },
    ]

    rulesGetProjects = [
        query('page').default(1)
            .isInt({ min: 1 }).withMessage('Page must be a number and must be greater than 0.'),
        query('limit').default(10)
            .isInt({ min: 1 }).withMessage('Limit must be a number and must be greater than 0.'),
        query('sort_by').default("asc(user_id)"),
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

    rulesProjectRequestModel = [
    ]

    rulesProjectResponseModel = [
    ]
}
