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
            // Root Folder Path Validation
            check('root_folder_path').exists().withMessage('No value provided.')
                .trim(),
            // Project Title Validation
            check('project_title').exists().withMessage('No value provided.')
                .trim(),
            // Project acrony Validation
            check('project_acronym').exists().withMessage('No value provided.')
                .trim(),
            // Project description Validation
            check('project_description').exists().withMessage('No value provided.')
                .trim(),
            // Project information Validation
            check('project_information').exists().withMessage('No value provided.')
                .trim(),

            // Project cruise Validation
            check('cruise').exists().withMessage('No value provided.')
                .trim(),

            // Project ship Validation 
            check('ship').exists().withMessage('No value provided.').trim(),

            // Data owner name Validation
            check('data_owner_name')
                .trim()
                .not().isEmpty().withMessage('Data owner name is required.'),

            //  Data owner email Validation
            check('data_owner_email').exists().withMessage('No value provided.')
                .trim()
                .normalizeEmail()
                .isEmail().withMessage('Data owner email must be a valid email address.')
                .bail(),

            // Operator name Validation
            check('operator_name').exists().withMessage('No value provided.')
                .trim(),
            // Operator email Validation
            check('operator_email').exists().withMessage('No value provided.')
                .trim()
                .normalizeEmail()
                .isEmail().withMessage('Operator email must be a valid email address.')
                .bail(),

            // Chief scientist name Validation
            check('chief_scientist_name').exists().withMessage('No value provided.')
                .trim(),

            // Chief scientist email Validation
            check('chief_scientist_email').exists().withMessage('No value provided.')
                .trim()
                .normalizeEmail()
                .isEmail().withMessage('Chief scientist email must be a valid email address.')
                .bail(),

            // Override depth offset Validation 
            check('override_depth_offset').optional().exists().withMessage('No value provided.')
                .isFloat().withMessage('Override depth offset must be a float value.'),

            // Enable descent filter Validation
            check('enable_descent_filter').exists().withMessage('No value provided.')
                .isBoolean().withMessage('Enable descent filter must be a boolean value.'),

            // Privacy duration Validation
            check('privacy_duration').exists().withMessage('No value provided.')
                .isInt({ min: 0 }).withMessage('Privacy duration must be a number and must be greater than 0.'),

            // Visible duration Validation 
            check('visible_duration').exists().withMessage('No value provided.')
                .isInt({ min: 0 }).withMessage('Visible duration must be a number and must be greater than 0.'),

            // Public duration Validation 
            check('public_duration').exists().withMessage('No value provided.')
                .isInt({ min: 0 }).withMessage('Public duration must be a number and must be greater than 0.'),

            // Instrument Validation 
            check('instrument').exists().withMessage('No value provided.') // TODO next sprin check this is an authorized instrument
                .trim()

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
        query('sort_by').default("asc(project_id)"),
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
