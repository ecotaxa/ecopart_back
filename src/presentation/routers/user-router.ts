import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareUserValidation } from '../interfaces/middleware/user-validation'
import { CreateUserUseCase } from '../../domain/interfaces/use-cases/user/create-user'
import { UpdateUserUseCase } from '../../domain/interfaces/use-cases/user/update-user'
import { ValidUserUseCase } from '../../domain/interfaces/use-cases/user/valid-user'
import { DeleteUserUseCase } from '../../domain/interfaces/use-cases/user/delete-user'
import { SearchUsersUseCase } from '../../domain/interfaces/use-cases/user/search-user'
import { CustomRequest } from '../../domain/entities/auth'

export default function UsersRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareUserValidation: IMiddlewareUserValidation,
    createUserUseCase: CreateUserUseCase,
    updateUserUseCase: UpdateUserUseCase,
    validUserUseCase: ValidUserUseCase,
    deleteUserUseCase: DeleteUserUseCase,
    searchUsersUseCase: SearchUsersUseCase
) {
    const router = express.Router()

    // Pagined and sorted list of all users
    router.get('/', middlewareAuth.auth, middlewareUserValidation.rulesGetUsers, async (req: Request, res: Response) => {
        try {
            const users = await searchUsersUseCase.execute((req as CustomRequest).token, { ...req.query } as any, []);
            res.status(200).send(users)
        } catch (err) {
            console.log(err)
            if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't get users"] })
        }
    })

    // Pagined and sorted list of filtered users
    router.post('/searches', middlewareAuth.auth, middlewareUserValidation.rulesGetUsers, async (req: Request, res: Response) => {
        try {
            const users = await searchUsersUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[]);
            res.status(200).send(users)
        } catch (err) {
            console.log(err)
            if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid filter statement ")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't search users"] })
        }
    })

    router.post('/', middlewareUserValidation.rulesUserRequesCreationtModel, async (req: Request, res: Response) => {
        try {
            const created_user = await createUserUseCase.execute(req.body)
            res.status(201).send(created_user)
        } catch (err) {
            console.log(err)
            if (err.message === "Valid user already exist") res.status(403).send({ errors: ["Can't create user"] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Can't update preexistent user") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Can't find updated preexistent user") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Can't find created user") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't create user"] })
        }
    })

    router.patch('/:user_id/', middlewareUserValidation.rulesUserUpdateModel, middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const updated_user = await updateUserUseCase.execute((req as CustomRequest).token, { ...req.body, user_id: req.params.user_id })
            res.status(200).send(updated_user)
        } catch (err) {
            console.log(err)
            if (err.message === "Logged user cannot update this property or user") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Can't find updated user") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't update user"] })
        }
    })

    router.get('/:user_id/welcome/:confirmation_token', async (req: Request, res: Response) => {
        try {
            // Call usecase validate user email
            await validUserUseCase.execute(parseInt(req.params.user_id), req.params.confirmation_token)

            // Redirect to login page // TODO?
            res.status(200).send({ message: "Account activated, please login" })
        } catch (err) {
            console.log(err)
            if (err.message === "Invalid confirmation token") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Invalid confirmation code") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User vallidation forbidden") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Can't update user") res.status(500).send({ errors: [err.message] })
            else if (err.message === "Can't find updated user") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Can't validate user") res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't welcome user"] })
        }
    })

    router.delete('/:user_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteUserUseCase.execute((req as CustomRequest).token, { ...req.body, user_id: req.params.user_id })
            if ((req as CustomRequest).token.user_id == parseInt(req.params.user_id)) {
                res
                    .clearCookie("access_token")
                    .clearCookie("refresh_token")
                    .status(200)
                    .json({ message: "You have been Logged Out and permanently deleted" });
            } else
                res.status(200).send({ message: "User successfully deleted" })
        } catch (err) {
            console.log(err)
            if (err.message === "Logged user cannot delete this user") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Can't find user to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Can't find deleted user") res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't delete user"] })
        }
    })

    return router
}