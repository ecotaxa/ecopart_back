import { NextFunction, Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { IMiddlewareAuthValidation } from '../interfaces/middleware/auth-validation';

export class MiddlewareAuthValidation implements IMiddlewareAuthValidation {
    rulesPassword = [
        check('user_id')
            .isNumeric()
            .isLength({ min: 1 })
            .trim()
            .not().isEmpty().withMessage('User id is required.'),

        // Password Validation
        check('password')
            .isLength({ min: 8 })
            .matches(/\d/)
            .matches(/[a-z]/)
            .matches(/[A-Z]/)
            .matches(/[@!#$%^&*()_+.,;:]/)
            .withMessage('Invalid credentials'),

        // New password Validation
        check('new_password')
            .isLength({ min: 8 })
            .matches(/\d/)
            .matches(/[a-z]/)
            .matches(/[A-Z]/)
            .matches(/[@!#$%^&*()_+.,;:]/)
            .withMessage('New password must be at least 8 characters long, contain at least a number, a lowercase letter, an uppercase letter and a special character.'),

        //check that password_hash is not defined
        check('password_hash')
            .isEmpty().withMessage('Password hash cannot be set manually.'),

        // Error Handling Middleware
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Centralized error handling for validation errors
                return res.status(422).json({ errors: ["Invalid credentials or missing user id"] });
            }
            next();
        },
    ]

    rulesAuthUserCredentialsModel = [
        // Email Validation
        check('email')
            .trim()
            .normalizeEmail()
            .isEmail()
            .bail(),

        // Password Validation
        check('password')
            .isLength({ min: 8 })
            .matches(/\d/)
            .matches(/[a-z]/)
            .matches(/[A-Z]/)
            .matches(/[@!#$%^&*()_+.,;:]/)
            .bail(),

        // Error Handling Middleware
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Centralized error handling for validation errors
                return res.status(401).json({ errors: ["Invalid credentials"] });
            }
            next();
        },
    ];

    rulesAuthEcoTaxaAccountCredentialsModel = [
        // Email Validation
        check('ecotaxa_user_login')
            .not().isEmpty()
            .trim()
            .isEmail()
            .withMessage('Invalid ecotaxa_user_login'),
        // Password Validation
        check('ecotaxa_user_password')
            .not().isEmpty()
            .withMessage('Invalid ecotaxa_user_password'),
        // ecotaxa instance id
        check('ecotaxa_instance_id')
            .not().isEmpty()
            .isNumeric()
            .withMessage('Invalid ecotaxa instance id'),
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

    rulesRequestResetPassword = [
        // Email Validation
        check('email')
            .trim()
            .normalizeEmail()
            .isEmail()
            .bail(),

        // Error Handling Middleware
        (req: Request, res: Response, next: NextFunction) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Centralized error handling for validation errors
                return res.status(401).json({ errors: ["Invalid credentials"] });
            }
            next();
        },
    ];

    rulesResetPassword = [
        // New password Validation
        check('new_password')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
            .matches(/\d/).withMessage('Password must contain a number.')
            .matches(/[a-z]/).withMessage('Password must contain a lowercase letter.')
            .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
            .matches(/[@!#$%^&*()_+.,;:]/).withMessage('Password must contain a special character.')
            .bail(),
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
