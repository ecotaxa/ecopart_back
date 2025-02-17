import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareUserValidation } from '../interfaces/middleware/user-validation'
import { CreateUserUseCase } from '../../domain/interfaces/use-cases/user/create-user'
import { UpdateUserUseCase } from '../../domain/interfaces/use-cases/user/update-user'
import { ValidUserUseCase } from '../../domain/interfaces/use-cases/user/valid-user'
import { DeleteUserUseCase } from '../../domain/interfaces/use-cases/user/delete-user'
import { SearchUsersUseCase } from '../../domain/interfaces/use-cases/user/search-user'
import { SearchEcotaxaAccountsUseCase } from '../../domain/interfaces/use-cases/ecotaxa_account/search-ecotaxa_account'
import { LoginEcotaxaAccountUseCase } from '../../domain/interfaces/use-cases/ecotaxa_account/login-ecotaxa_account'
import { LogoutEcotaxaAccountUseCase } from '../../domain/interfaces/use-cases/ecotaxa_account/logout-ecotaxa_account'
import { CustomRequest } from '../../domain/entities/auth'
import { MiddlewareAuthValidation } from '../middleware/auth-validation'

export default function UsersRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareUserValidation: IMiddlewareUserValidation,
    middlewareAuthValidation: MiddlewareAuthValidation,
    createUserUseCase: CreateUserUseCase,
    updateUserUseCase: UpdateUserUseCase,
    validUserUseCase: ValidUserUseCase,
    deleteUserUseCase: DeleteUserUseCase,
    loginEcotaxaAccountUseCase: LoginEcotaxaAccountUseCase,
    logoutEcotaxaAccountUseCase: LogoutEcotaxaAccountUseCase,
    searchUsersUseCase: SearchUsersUseCase,
    searchEcotaxaAccountsUseCase: SearchEcotaxaAccountsUseCase
) {
    const router = express.Router()

    // Pagined and sorted list of all users
    router.get('/', middlewareAuth.auth, middlewareUserValidation.rulesGetUsers, async (req: Request, res: Response) => {
        try {
            const users = await searchUsersUseCase.execute((req as CustomRequest).token, { ...req.query } as any, []);
            res.status(200).send(users)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get users"] })
        }
    })

    // Pagined and sorted list of filtered users
    router.post('/searches', middlewareAuth.auth, middlewareUserValidation.rulesGetUsers, async (req: Request, res: Response) => {
        try {
            const users = await searchUsersUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[]);
            res.status(200).send(users)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid filter statement ")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search users"] })
        }
    })

    router.post('/', middlewareUserValidation.rulesUserRequestCreationModel, async (req: Request, res: Response) => {
        try {
            await createUserUseCase.execute(req.body)
            res.status(201).send({ message: "User sucessfully created." })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Valid user already exist") res.status(403).send({ errors: ["Cannot create user"] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot update preexistent user") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find updated preexistent user") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot find created user") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot create user"] })
        }
    })

    router.patch('/:user_id/', middlewareUserValidation.rulesUserUpdateModel, middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const updated_user = await updateUserUseCase.execute((req as CustomRequest).token, { ...req.body, user_id: req.params.user_id })
            res.status(200).send(updated_user)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Logged user cannot update this property or user") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find updated user") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot update user"] })
        }
    })

    router.get('/:user_id/welcome/:confirmation_token', async (req: Request, res: Response) => {
        try {
            // Call usecase validate user email
            await validUserUseCase.execute(parseInt(req.params.user_id), req.params.confirmation_token)

            // Redirect to login page // TODO?
            res.status(200).send({ message: "Account activated, please login" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Invalid confirmation token") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User vallidation forbidden") res.status(403).send({ errors: [err.message] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find user with confirmation code") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot update user") res.status(500).send({ errors: [err.message] })
            else if (err.message === "Cannot find updated user") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot validate user") res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot welcome user"] })
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
            console.log(new Date().toISOString(), err)
            if (err.message === "Logged user cannot delete this user") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find user to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find deleted user") res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete user"] })
        }
    })
    /********** ECOTAXA ACCOUNTS ENDPOINTS ***********/
    // login to an ecotaxa Account
    router.post('/:user_id/ecotaxa_account', middlewareAuth.auth, middlewareAuthValidation.rulesAuthEcoTaxaAccountCredentialsModel, async (req: Request, res: Response) => {
        try {
            const ecotaxa_account = await loginEcotaxaAccountUseCase.execute((req as CustomRequest).token, { ...req.body, ecopart_user_id: req.params.user_id })
            res.status(200).send(ecotaxa_account)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Logged user cannot login to this ecotaxa account") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "User cannot add account to the desired ecopart user") res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Ecotaxa instance not found ")) res.status(404).send({ errors: [err.message] })
            else if (err.message === "Ecotaxa instance id should be a number") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot create ecotaxa account") res.status(500).send({ errors: [err.message] })
            else if (err.message === "Account already exists") res.status(401).send({ errors: [err.message] })
            else if (err.message === "HTTP Error: 403") res.status(403).send({ errors: ["Cannot login ecotaxa account"] })
            else res.status(500).send({ errors: ["Cannot login ecotaxa account"] })
        }
    })
    //    logout from an ecotaxa Account
    router.delete('/:user_id/ecotaxa_account/:ecotaxa_account_id', middlewareAuth.auth, middlewareUserValidation.rulesLogoutEcoTaxaAccount, async (req: Request, res: Response) => {
        try {
            await logoutEcotaxaAccountUseCase.execute((req as CustomRequest).token, Number(req.params.user_id), Number(req.params.ecotaxa_account_id))
            res.status(200).send({ message: "You have been logged out from ecotaxa account" });
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "Logged user cannot delete this ecotaxa account") res.status(401).send({ errors: [err.message] })
            else if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "User cannot logout from the requested ecotaxa account") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Ecotaxa account not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete logout ecotaxa account"] })
        }
    })
    // Pagined and sorted list of all ecotaxa accounts for a user
    router.get('/:user_id/ecotaxa_account/', middlewareAuth.auth, middlewareUserValidation.rulesGetUsers, async (req: Request, res: Response) => {
        try {
            const ecotaxa_accounts = await searchEcotaxaAccountsUseCase.execute((req as CustomRequest).token, Number(req.params.user_id), { ...req.query } as any);
            res.status(200).send(ecotaxa_accounts)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("User cannot get requested ecotaxa accounts")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized sort_by")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized order_by")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get ecotaxa accounts for user : " + req.params.user_id] })
        }
    })
    return router
}