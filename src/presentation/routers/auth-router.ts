import express, { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareAuthValidation } from '../interfaces/middleware/auth-validation'

import { CustomRequest } from '../../domain/entities/auth'

import { LoginUserUseCase } from '../../domain/interfaces/use-cases/auth/login'
import { RefreshTokenUseCase } from '../../domain/interfaces/use-cases/auth/refresh-token'
import { ChangePasswordUseCase } from '../../domain/interfaces/use-cases/auth/change-password'
import { ResetPasswordRequestUseCase } from '../../domain/interfaces/use-cases/auth/reset-password-request'
import { ResetPasswordUseCase } from '../../domain/interfaces/use-cases/auth/reset-password'

// Password securituy rules //HTTPS //SALTING before hashing //rate limiting //timeout //SSO
export default function AuthRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareAuthValidation: IMiddlewareAuthValidation,
    loginUserUseCase: LoginUserUseCase,
    refreshTokenUseCase: RefreshTokenUseCase,
    changePasswordUseCase: ChangePasswordUseCase,
    resetPasswordRequestUseCase: ResetPasswordRequestUseCase,
    resetPasswordUseCase: ResetPasswordUseCase
) {
    const router = express.Router()

    const http0nlyCookie = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "PROD",
    }

    /* LOGIN MANAGEMENT */
    router.post('/login', middlewareAuthValidation.rulesAuthUserCredentialsModel, async (req: Request, res: Response) => {
        try {
            const tokens = await loginUserUseCase.execute(req.body)
            res
                .cookie("access_token", tokens.jwt, http0nlyCookie)
                .cookie("refresh_token", tokens.jwt_refresh, http0nlyCookie)
                .status(200)
                .send(tokens)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Invalid credentials") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "User email not verified") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot login"] })
        }
    })

    router.get('/user/me', middlewareAuth.auth, async (req: Request, res: Response) => {
        res.status(200).send((req as CustomRequest).token)
    })

    router.post('/refreshToken', middlewareAuth.auth_refresh, async (req: Request, res: Response) => {
        try {
            const user = (req as CustomRequest).token
            const token = await refreshTokenUseCase.execute(user)
            res
                .status(200)
                .cookie("access_token", token.jwt, http0nlyCookie)
                .send(token)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Cannot find user") res.status(404).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot refresh token"] })
        }
    })

    router.post('/logout', async (req: Request, res: Response) => {
        res
            .clearCookie("access_token")
            .clearCookie("refresh_token")
            .status(200)
            .json({ message: "You are Logged Out" });
    })

    /* PASSWORD MANAGEMENT */
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