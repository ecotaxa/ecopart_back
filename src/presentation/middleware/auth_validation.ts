import { NextFunction, Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { IMiddlewareAuthValidation } from '../interfaces/middleware/auth_validation';


export class MiddlewareAuthValidation implements IMiddlewareAuthValidation {

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
