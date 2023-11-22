import { Secret } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { MiddlewareAuth } from "../interfaces/middleware/auth";
import { CustomRequest, DecodedToken } from '../../domain/entities/auth';
import { JwtAdapter } from '../../infra/auth/jsonwebtoken';

/**
 * Middleware for authenticating using JWT stored in HTTP-only cookies.
 * Implements the MiddlewareAuth interface.
 */
export class MiddlewareAuthCookie implements MiddlewareAuth {

    // Private properties to store secret keys
    SECRET_KEY_ACCESS: Secret;
    SECRET_KEY_REFRESH: Secret;
    jwt: JwtAdapter

    /**
     * Constructor to initialize the secret keys.
     * @param {Secret} SECRET_KEY_ACCESS - Secret key for access tokens.
     * @param {Secret} SECRET_KEY_REFRESH - Secret key for refresh tokens.
     */
    constructor(jwtAdapter: JwtAdapter, SECRET_KEY_ACCESS: Secret, SECRET_KEY_REFRESH: Secret) {
        this.jwt = jwtAdapter
        this.SECRET_KEY_ACCESS = SECRET_KEY_ACCESS;
        this.SECRET_KEY_REFRESH = SECRET_KEY_REFRESH;
    }

    /**
    * Middleware function to authenticate using access token stored in an HTTP-only cookie.
    * @param {Request} req - Express request object.
    * @param {Response} res - Express response object.
    * @param {NextFunction} next - Next middleware function.
    */
    auth = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Retrieve the access token from the cookie
            const token = req.cookies?.access_token;

            // If token is missing, send a 401 Unauthorized response
            if (!token) return res.status(401).send({ errors: ['Token missing. Please authenticate.'] })

            // Verify the token using the access secret key
            const decoded = this.jwt.verify(token, this.SECRET_KEY_ACCESS);

            // Attach the decoded token to the request object
            (req as CustomRequest).token = (decoded as DecodedToken);
            // Continue to the next middleware
            next();
        } catch (err) {
            // Send a 401 Unauthorized response for token verification errors
            return res.status(401).send({ errors: ['Token invalid or expired. Please authenticate.'] })

        }
    };

    /**
    * Middleware function to authenticate using refresh token stored in an HTTP-only cookie
    * @param {Request} req - Express request object.
    * @param {Response} res - Express response object.
    * @param {NextFunction} next - Next middleware function.
    */
    auth_refresh = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Retrieve the refresh token from the cookie
            const token: string | null = req.cookies?.refresh_token;
            // If token is missing, send a 401 Unauthorized response
            if (!token) return res.status(401).send({ errors: ['Refresh token missing. Please authenticate.'] })


            // Verify the token using the refresh secret key
            const decoded = this.jwt.verify(token, this.SECRET_KEY_REFRESH);

            // Attach the decoded token to the request object
            (req as CustomRequest).token = (decoded as DecodedToken);

            // Continue to the next middleware
            next();
        } catch (err) {
            // Send a 401 Unauthorized response for token verification errors
            return res.status(401).send({ errors: ['Refresh token invalid or expired. Please authenticate.'] });
        }
    };
}

/*
// Middleware functions that read JWT from the Authorization bearer token (not used)
export const auth_bearer_token = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Retrieve the token from the Authorization header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        // If token is missing, throw an error
        if (!token) throw new Error();

        // Verify the token using the access secret key (SECRET_KEY_ACCESS is not defined here)
        const decoded = jwt.verify(token, SECRET_KEY_ACCESS);

        // Attach the decoded token to the request object
        (req as CustomRequest).token = decoded;

        // Continue to the next middleware
        next();
    } catch (err) {
        // Send a 401 Unauthorized response for token verification errors
        res.status(401).send('Please authenticate');
    }
};

// Middleware function similar to auth_bearer_token but for refresh tokens (not used)
export const auth_refresh_bearer_token = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Retrieve the token from the Authorization header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        // If token is missing, throw an error
        if (!token) throw new Error();

        // Verify the token using the refresh secret key (SECRET_KEY_REFRESH is not defined here)
        const decoded = jwt.verify(token, SECRET_KEY_REFRESH);

        // Attach the decoded token to the request object
        (req as CustomRequest).token = decoded;

        // Continue to the next middleware
        next();
    } catch (err) {
        // Send a 401 Unauthorized response for token verification errors
        res.status(401).send('Please authenticate');
    }
};
*/
