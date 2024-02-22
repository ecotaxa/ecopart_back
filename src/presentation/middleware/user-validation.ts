import { NextFunction, Request, Response } from 'express';
import { check, validationResult, query } from 'express-validator';
import { CountriesAdapter } from '../../infra/countries/country';
import { IMiddlewareUserValidation } from '../interfaces/middleware/user-validation';


export class MiddlewareUserValidation implements IMiddlewareUserValidation {
    // Private properties to store secret keys
    countries: any

    constructor(countries: CountriesAdapter) {
        this.countries = countries.listCountries();
    }

    rulesUserRequesCreationtModel = [
        // Password Validation
        check('password')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
            .matches(/\d/).withMessage('Password must contain a number.')
            .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
            .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
            .matches(/[@!#$%^&*()_+.,;:]/).withMessage('Password must contain a special character.')
            .bail(),

        // First Name Validation
        check('first_name')
            .trim()
            .not().isEmpty().withMessage('First name is required.'),

        // Last Name Validation
        check('last_name')
            .trim()
            .not().isEmpty().withMessage('Last name is required.'),

        // Email Validation
        check('email')
            .trim()
            .normalizeEmail()
            .isEmail().withMessage('Email must be a valid email address.')
            .bail(),

        // Confirmation Code Validation (optional field)
        check('confirmation_code')
            .isEmpty().withMessage('Confirmation code cannot be set manually.'),

        // Organisation Validation
        check('organisation')
            .trim()
            .not().isEmpty().withMessage('Organisation is required.'),

        // Country Validation
        check('country')
            .trim()
            .not().isEmpty().withMessage('Country is required.')
            .custom(value => {
                if (!this.countries.isValid(value)) {
                    throw new Error('Invalid country. Please select from the list.');
                }
                return true;
            }),
        // User Planned Usage Validation
        check('user_planned_usage')
            .trim()
            .not().isEmpty().withMessage('User planned usage is required.'),


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

    rulesUserUpdateModel = [

        // First Name Validation
        check('first_name').optional()
            .trim(),

        // Last Name Validation
        check('last_name').optional()
            .trim(),

        // Email Validation
        check('email').optional()
            .trim()
            .normalizeEmail()
            .isEmail().withMessage('Email must be a valid email address.')
            .bail(),

        // Valid email Validation
        check('valid_email').optional()
            .trim(),

        // Is Admin Validation
        check('is_admin').optional()
            .trim(),

        // Confirmation Code Validation (optional field)
        check('confirmation_code').optional(),

        // Organisation Validation
        check('organisation').optional()
            .trim(),

        // Country Validation
        check('country').optional()
            .trim()
            .custom(value => {
                if (!this.countries.isValid(value)) {
                    throw new Error('Invalid country. Please select from the list.');
                }
                return true;
            }),

        // User Planned Usage Validation
        check('user_planned_usage').optional()
            .trim(),
        // User Creation Date Validation
        check('user_creation_date')
            .isEmpty().withMessage('User creation date cannot be set manually.'),
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

    rulesGetUsers = [
        query('page').default(1)
            .isInt({ min: 1 }).withMessage('Page must be a number and must be greater than 0.'),
        query('limit').default(10)
            .isInt({ min: 1 }).withMessage('Limit must be a number and must be greater than 0.'),
        query('sort_by').default("asc(user_id)")
            .isString().withMessage('Sort_by must be a string formatted as follow : desc(field1),asc(field2),desc(field3),...'),
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

    rulesUserRequestModel = [
    ]

    rulesUserResponseModel = [
    ]
}
