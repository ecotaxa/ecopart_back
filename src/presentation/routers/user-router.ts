import express from 'express'
import { Request, Response } from 'express'
import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { CreateUserUseCase } from '../../domain/interfaces/use-cases/user/create-user'
import { GetAllUsersUseCase } from '../../domain/interfaces/use-cases/user/get-all-users'
import { UpdateUserUseCase } from '../../domain/interfaces/use-cases/user/update-user'
import { CustomRequest } from '../../domain/entities/auth'

export default function UsersRouter(
    middlewareAuth: MiddlewareAuth,
    getAllUsersUseCase: GetAllUsersUseCase,
    createUserUseCase: CreateUserUseCase,
    updateUserUseCase: UpdateUserUseCase
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
            res.status(500).send({ errors: ["Can't create user"] })
        }
    })


    // 401/500 
    router.patch('/:id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            //const updated_user = await updateUserUseCase.execute({ ...req.body, id: req.params.id })
            const updated_user = await updateUserUseCase.execute((req as CustomRequest).token, { ...req.body, id: req.params.id })
            res.statusCode = 201
            res.json(updated_user)
        } catch (err) {
            res.status(500).send({ errors: ["Can't update user"] })
        }
    })

    return router
}