import { NextFunction, Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { IMiddlewareAuthValidation } from '../interfaces/middleware/auth_validation';

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


}
