import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { CustomRequest } from '../../domain/entities/auth'

import { LoginUserUseCase } from '../../domain/interfaces/use-cases/auth/login'
import { RefreshTokenUseCase } from '../../domain/interfaces/use-cases/auth/refreshToken'


// TODO password securituy rules //HTTPS //SALTING before hashing //rate limiting //timeout //SSO
export default function AuthRouter(
    middlewareAuth: MiddlewareAuth,
    loginUserUseCase: LoginUserUseCase,
    refreshTokenUseCase: RefreshTokenUseCase,

) {
    const router = express.Router()

    const http0nlyCookie = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "PROD",
    }

    router.post('/login', async (req: Request, res: Response) => {
        try {
            const tokens = await loginUserUseCase.execute(req.body)
            console.log("tokens", tokens)
            res
                .cookie("access_token", tokens.jwt, http0nlyCookie)
                .cookie("refresh_token", tokens.jwt_refresh, http0nlyCookie)
                .status(200)
                .send(tokens)
        } catch (err) {
            console.log(err)
            if (err.message === "Invalid credentials") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User email not verified") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't login"] })
        }
    })

    router.get('/user/me', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            // TODO check if user valid?
            res.status(200).send((req as CustomRequest).token)
        } catch (err) {
            console.log(err.message)
            res.status(500).send({ errors: ["Can't get user me"] })
        }
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
            console.log(err)
            if (err.message === "Can't find user") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't refresh token"] })
        }
    })


    router.post('/logout', async (req: Request, res: Response) => {
        try {
            res
                .clearCookie("access_token")
                .clearCookie("refresh_token")
                .status(200)
                .json({ response: "You are Logged Out" });
        } catch (err) {
            console.log(err)
            res.status(500).send({ errors: ["Can't logout"] })
        }
    })

    // /* TODO PASSWORD MANAGEMENT */
    // //change password TODO
    // router.post('/password/change', async (req: Request, res: Response) => {
    //     try {

    //         const token = await loginUserUseCase.execute(req.body)
    //         res.statusCode = 200// to check
    //         res.json(token)
    //     } catch (err) {
    //         // res.status(500).send({ message: "Error saving data" }) // TODO remonter le bon message
    //         res.status(500).send({ message: err }) // TODO remonter le bon message
    //     }
    // })

    // // reset password request TODO
    // router.post('/password/reset', middlewareAuth.auth, async (req: Request, res: Response) => {
    //     try {

    //         const token = await loginUserUseCase.execute(req.body)
    //         res.statusCode = 200// to check
    //         res.json(token)
    //     } catch (err) {
    //         // res.status(500).send({ message: "Error saving data" }) // TODO remonter le bon message
    //         res.status(500).send({ message: err }) // TODO remonter le bon message
    //     }
    // })

    // // reset password confirm TODO
    // router.put('/password/reset', middlewareAuth.auth, async (req: Request, res: Response) => {
    //     try {

    //         const token = await loginUserUseCase.execute(req.body)
    //         res.statusCode = 200// to check
    //         res.json(token)
    //     } catch (err) {
    //         // res.status(500).send({ message: "Error saving data" }) // TODO remonter le bon message
    //         res.status(500).send({ message: err }) // TODO remonter le bon message
    //     }
    // })


    return router
}