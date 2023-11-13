import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { CreateUserUseCase } from '../../domain/interfaces/use-cases/user/create-user'
import { GetAllUsersUseCase } from '../../domain/interfaces/use-cases/user/get-all-users'
import { UpdateUserUseCase } from '../../domain/interfaces/use-cases/user/update-user'
import { ValidUserUseCase } from '../../domain/interfaces/use-cases/user/valid-user'
import { CustomRequest } from '../../domain/entities/auth'

export default function UsersRouter(
    middlewareAuth: MiddlewareAuth,
    getAllUsersUseCase: GetAllUsersUseCase,
    createUserUseCase: CreateUserUseCase,
    updateUserUseCase: UpdateUserUseCase,
    validUserUseCase: ValidUserUseCase
) {
    const router = express.Router()

    router.get('/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const users = await getAllUsersUseCase.execute()
            res.send(users)
        } catch (err) {
            res.status(500).send({ message: err })
        }
    })

    router.post('/', async (req: Request, res: Response) => {
        try {
            const created_user = await createUserUseCase.execute(req.body)
            res.statusCode = 201
            res.json(created_user)
        } catch (err) {
            //catch validation error or catch user email conflict
            res.status(500).send({ errors: ["Can't create user"] })
        }
    })


    // 401/500 
    router.patch('/:user_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            //const updated_user = await updateUserUseCase.execute({ ...req.body, user_id: req.params.user_id })
            const updated_user = await updateUserUseCase.execute((req as CustomRequest).token, { ...req.body, user_id: req.params.user_id })
            res.statusCode = 200
            res.json(updated_user)
        } catch (err) {
            res.status(500).send({ errors: ["Can't update user"] })
        }
    })

    router.get('/:user_id/welcome/:confirmation_token', async (req: Request, res: Response) => {
        try {
            // call usecase validate user email
            await validUserUseCase.execute(parseInt(req.params.user_id), req.params.confirmation_token)

            // redirect to login page // TODO?
            res.status(200).send("Account activated, please login")

        } catch (err) {
            console.log(err)
            res.status(500).send({ errors: ["Can't welcome user"] })
        }
    })
    return router
}