import express, { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareAuthValidation } from '../interfaces/middleware/auth-validation'

import { CustomRequest } from '../../domain/entities/auth'

import { LoginUserUseCase } from '../../domain/interfaces/use-cases/auth/login'
import { RefreshTokenUseCase } from '../../domain/interfaces/use-cases/auth/refresh-token'
import { ChangePasswordUseCase } from '../../domain/interfaces/use-cases/auth/change-password'
import { ResetPasswordRequestUseCase } from '../../domain/interfaces/use-cases/auth/reset-password-request'
import { ResetPasswordUseCase } from '../../domain/interfaces/use-cases/auth/reset-password'
import { SearchUsersUseCase } from '../../domain/interfaces/use-cases/user/search-user'
import { LogoutUserUseCase } from '../../domain/interfaces/use-cases/auth/logout'

// Password securituy rules //HTTPS //SALTING before hashing //rate limiting //timeout //SSO
export default function AuthRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareAuthValidation: IMiddlewareAuthValidation,
    loginUserUseCase: LoginUserUseCase,
    refreshTokenUseCase: RefreshTokenUseCase,
    changePasswordUseCase: ChangePasswordUseCase,
    resetPasswordRequestUseCase: ResetPasswordRequestUseCase,
    resetPasswordUseCase: ResetPasswordUseCase,
    searchUsersUseCase: SearchUsersUseCase,
    logoutUserUseCase: LogoutUserUseCase
) {
    const router = express.Router()

    const http0nlyCookie = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "PROD",
        // Not sent on cross-site POST/PUT/DELETE, which blocks CSRF; the front is served from the same site.
        sameSite: "lax" as const,
    }

    /* LOGIN MANAGEMENT */
    /**
     * @openapi
     * /auth/login:
     *   post:
     *     summary: User login
     *     description: Authenticate a user with email and password. JWT tokens are only returned as httpOnly cookies, the body holds the user.
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/AuthUserCredentials'
     *     responses:
     *       200:
     *         description: Login successful. JWT tokens are set as httpOnly cookies.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PublicUser'
     *       401:
     *         description: Invalid credentials.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used or email not verified.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post('/login', middlewareAuthValidation.rulesAuthUserCredentialsModel, async (req: Request, res: Response) => {
        try {
            const { jwt, jwt_refresh, ...user } = await loginUserUseCase.execute(req.body)
            // Tokens only travel in httpOnly cookies, never in a body that page scripts can read
            res
                .cookie("access_token", jwt, http0nlyCookie)
                .cookie("refresh_token", jwt_refresh, http0nlyCookie)
                .status(200)
                .send(user)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Invalid credentials") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "User email not verified") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot login"] })
        }
    })

    /**
     * @openapi
     * /auth/user/me:
     *   get:
     *     summary: Get current user
     *     description: Returns the authenticated user's profile information based on the JWT token.
     *     tags: [Auth]
     *     security:
     *       - cookieAccessToken: []
     *     responses:
     *       200:
     *         description: Current user information.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PublicUser'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: User not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/user/me', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            // Fetch fresh user data from the database using the user_id from the token
            const token = (req as CustomRequest).token
            const result = await searchUsersUseCase.execute((req as CustomRequest).token, { page: 1, limit: 1, sort_by: 'asc(user_id)' }, [{ field: 'user_id', operator: '=', value: token.user_id }])
            if (result.users.length === 0) {
                res.status(404).send({ errors: ['Cannot find user'] })
                return
            }
            res.status(200).send(result.users[0])
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === 'User cannot be used') res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ['Cannot get user info'] })
        }
    })

    /**
     * @openapi
     * /auth/refreshToken:
     *   post:
     *     summary: Refresh access token
     *     description: Uses the refresh token cookie to generate a new access token, as long as its login session is active. The session end is pushed back and the refresh token cookie is reissued.
     *     tags: [Auth]
     *     security:
     *       - cookieRefreshToken: []
     *     responses:
     *       200:
     *         description: New access and refresh tokens set as cookies.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: Missing or invalid refresh token, or its session was revoked (logout, password change or reset) or has expired.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: User not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post('/refreshToken', middlewareAuth.auth_refresh, async (req: Request, res: Response) => {
        try {
            const user = (req as CustomRequest).token
            const token = await refreshTokenUseCase.execute(user)
            // The refresh token is reissued too: the session end moved forward, so must the token expiry
            res
                .status(200)
                .cookie("access_token", token.jwt, http0nlyCookie)
                .cookie("refresh_token", token.jwt_refresh, http0nlyCookie)
                .send({ message: "Access token refreshed" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Session revoked or expired") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find user") res.status(404).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot refresh token"] })
        }
    })

    /**
     * @openapi
     * /auth/logout:
     *   post:
     *     summary: Logout
     *     description: Revokes the login session of the refresh token cookie, then clears the access and refresh token cookies. Always succeeds.
     *     tags: [Auth]
     *     responses:
     *       200:
     *         description: Successfully logged out.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     */
    router.post('/logout', async (req: Request, res: Response) => {
        try {
            await logoutUserUseCase.execute(req.cookies?.refresh_token)
        } catch (err) {
            // The cookies are cleared anyway: logging out must always succeed for the browser
            console.log(new Date().toISOString(), err)
        }
        res
            .clearCookie("access_token")
            .clearCookie("refresh_token")
            .status(200)
            .json({ message: "You are Logged Out" });
    })

    /* PASSWORD MANAGEMENT */
    /**
     * @openapi
     * /auth/password/change:
     *   post:
     *     summary: Change password
     *     description: Change the password of the authenticated user. Requires current and new password.
     *     tags: [Auth]
     *     security:
     *       - cookieAccessToken: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ChangePasswordRequest'
     *     responses:
     *       200:
     *         description: Password successfully changed.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: New password must be different from old password.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       422:
     *         description: Validation error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Change password
    router.post('/password/change', middlewareAuthValidation.rulesPassword, middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await changePasswordUseCase.execute((req as CustomRequest).token, req.body)
            //TODO Unvalidate EXISTING TOKENS for the user?
            //TODO logout user?
            res
                .status(200)
                .json({ message: "Password sucessfully changed" });
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "New password must be different from old password") res.status(401).send({ errors: ["New password must be different from old password"] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot change password"] })
        }
    })

    /**
     * @openapi
     * /auth/password/reset:
     *   post:
     *     summary: Request password reset
     *     description: Sends a password reset email to the given address. Always returns 200 to prevent email enumeration.
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ResetPasswordRequest'
     *     responses:
     *       200:
     *         description: Reset password request email sent (or user not found, same response for security).
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       403:
     *         description: Cannot reset password.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Reset password request
    router.post('/password/reset', middlewareAuthValidation.rulesRequestResetPassword, async (req: Request, res: Response) => {
        try {
            await resetPasswordRequestUseCase.execute(req.body)
            res
                .status(200)
                .json({ message: "Reset password request email sent." });
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User does not exist") res.status(200).send({ message: "Reset password request email sent." })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: ["Cannot reset password"] })
            else if (err.message === "User email is not validated") res.status(200).send({ message: "Reset password request email sent." })
            else if (err.message === "Cannot set password reset code") res.status(500).send({ errors: ["Cannot reset password"] })
            else if (err.message === "Cannot find updated user") res.status(500).send({ errors: ["Cannot reset password"] })
            else res.status(500).send({ errors: ["Cannot reset password"] })
        }
    })

    /**
     * @openapi
     * /auth/password/reset:
     *   put:
     *     summary: Confirm password reset
     *     description: Completes the password reset process using a reset token and new password.
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ResetPasswordConfirm'
     *     responses:
     *       200:
     *         description: Password successfully reset.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: Token is not valid or no token provided.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used or email not validated.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: User not found or reset code invalid.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       422:
     *         description: Validation error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Reset password confirm
    router.put('/password/reset', middlewareAuthValidation.rulesResetPassword, async (req: Request, res: Response) => {
        try {
            await resetPasswordUseCase.execute(req.body)
            res
                .status(200)
                .json({ message: "Password sucessfully reset, please login" });
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Token is not valid") res.status(401).send({ errors: ["Cannot reset password"] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: ["Cannot reset password"] })
            else if (err.message === "No token provided") res.status(401).send({ errors: ["Cannot reset password"] })
            else if (err.message === "User does not exist or reset_password_code is not valid") res.status(404).send({ errors: ["Cannot reset password"] })
            else if (err.message === "User email is not validated") res.status(403).send({ errors: ["Cannot reset password"] })
            else res.status(500).send({ errors: ["Cannot reset password"] })
        }
    })

    return router
}