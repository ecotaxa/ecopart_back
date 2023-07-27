import express from 'express'
import { Request, Response } from 'express'
import { CreateUserUseCase } from '../../domain/interfaces/use-cases/user/create-user'
import { GetAllUsersUseCase } from '../../domain/interfaces/use-cases/user/get-all-users'


export default function UsersRouter(
    getAllUsersUseCase: GetAllUsersUseCase,
    createUserUseCase: CreateUserUseCase
) {
    const router = express.Router()

    router.get('/', async (req: Request, res: Response) => {
        try {
            const users = await getAllUsersUseCase.execute()
            res.send(users)
        } catch (err) {
            res.status(500).send({ message: "Error fetching data" })
        }
    })

    router.post('/', async (req: Request, res: Response) => {
        try {
            const created_user = await createUserUseCase.execute(req.body)
            res.statusCode = 201
            res.json(created_user)
        } catch (err) {
            // res.status(500).send({ message: "Error saving data" }) // TODO remonter le bon message
            res.status(500).send({ message: err }) // TODO remonter le bon message
        }
    })

    return router
}