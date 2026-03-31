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
import { ListOrganisationsUseCase } from '../../domain/interfaces/use-cases/user/list-organisations'
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
    searchEcotaxaAccountsUseCase: SearchEcotaxaAccountsUseCase,
    listOrganisationsUseCase: ListOrganisationsUseCase
) {
    const router = express.Router()

    /**
     * @openapi
     * /users/organisations:
     *   get:
     *     summary: List all organisations
     *     description: Returns a list of all distinct organisation names from registered users.
     *     tags: [Users]
     *     responses:
     *       200:
     *         description: List of organisation names.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // List of all distinct organisations
    router.get('/organisations', async (req: Request, res: Response) => {
        try {
            const organisations = await listOrganisationsUseCase.execute();
            res.status(200).send(organisations)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            res.status(500).send({ errors: ["Cannot get organisations"] })
        }
    })

    /**
     * @openapi
     * /users:
     *   get:
     *     summary: List users
     *     description: Returns a paginated and sorted list of all users. Requires authentication.
     *     tags: [Users]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     responses:
     *       200:
     *         description: Paginated list of users.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/UserSearchResponse'
     *       401:
     *         description: Unauthorized or invalid parameters.
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
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
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

    /**
     * @openapi
     * /users/searches:
     *   post:
     *     summary: Search users
     *     description: |
     *       Returns a paginated, sorted, and filtered list of users.
     *
     *       **Filtering** — Send an array of filter objects in the request body. Each filter has `field`, `operator`, and `value`.
     *
     *       Supported operators:
     *       | Operator | Value type | Description |
     *       |----------|------------|-------------|
     *       | `=`      | string, number, boolean | Exact match |
     *       | `!=` / `<>` | string, number, boolean | Not equal |
     *       | `>` `>=` `<` `<=` | number | Numeric comparison |
     *       | `IN`     | array | Value is one of the given items |
     *       | `LIKE`   | string | Case-insensitive pattern match (`%` = any chars, `_` = one char) |
     *
     *       Use the string `"null"` as value to match NULL fields (`= "null"` → `IS NULL`, `!= "null"` → `IS NOT NULL`).
     *
     *       **Pagination** — Use query parameters `page` (default 1) and `limit` (default 10).
     *
     *       **Sorting** — Use the `sort_by` query parameter with the format `asc(field)` or `desc(field)`. Chain multiple sorts with commas, e.g. `asc(last_name),desc(user_id)`.
     *     tags: [Users]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: array
     *             items:
     *               $ref: '#/components/schemas/FilterSearchOptions'
     *           example:
     *             - field: "valid_email"
     *               operator: "="
     *               value: true
     *             - field: "user_id"
     *               operator: "="
     *               value: 1
     *     responses:
     *       200:
     *         description: Paginated filtered list of users.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/UserSearchResponse'
     *       401:
     *         description: Unauthorized or invalid parameters/filters.
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
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
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

    /**
     * @openapi
     * /users:
     *   post:
     *     summary: Create user
     *     description: Register a new user account. Does not require authentication. A confirmation email will be sent.
     *     tags: [Users]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UserRequestCreation'
     *     responses:
     *       201:
     *         description: User successfully created.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       403:
     *         description: User already exists or is deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Cannot find created user.
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

    /**
     * @openapi
     * /users/{user_id}:
     *   patch:
     *     summary: Update user
     *     description: Update an existing user's profile. Requires authentication. Users can update their own profile; admins can update any user.
     *     tags: [Users]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: user_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The user ID to update.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/UserUpdate'
     *     responses:
     *       200:
     *         description: Updated user profile.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PublicUser'
     *       401:
     *         description: Unauthorized to update this user or property.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used or is deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Cannot find user to update.
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

    /**
     * @openapi
     * /users/{user_id}/welcome/{confirmation_token}:
     *   get:
     *     summary: Activate user account
     *     description: Validates a user's email using the confirmation token sent by email.
     *     tags: [Users]
     *     parameters:
     *       - name: user_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The user ID to activate.
     *       - name: confirmation_token
     *         in: path
     *         required: true
     *         schema:
     *           type: string
     *         description: The confirmation token from the welcome email.
     *     responses:
     *       200:
     *         description: Account activated.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: Invalid confirmation token.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User validation forbidden or user is deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Cannot find user with confirmation code.
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

    /**
     * @openapi
     * /users/{user_id}:
     *   delete:
     *     summary: Delete user
     *     description: Permanently delete a user account. Users can delete their own account (which also logs them out); admins can delete any user.
     *     tags: [Users]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: user_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The user ID to delete.
     *     responses:
     *       200:
     *         description: User successfully deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: Logged user cannot delete this user.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used or is deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Cannot find user to delete.
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
    /**
     * @openapi
     * /users/{user_id}/ecotaxa_account:
     *   post:
     *     summary: Login to EcoTaxa account
     *     description: Link an EcoTaxa account to the specified user by providing EcoTaxa credentials.
     *     tags: [Users]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: user_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The EcoPart user ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/EcotaxaAccountLogin'
     *     responses:
     *       200:
     *         description: EcoTaxa account successfully linked.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PublicEcotaxaAccountResponse'
     *       401:
     *         description: Unauthorized or account already exists.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used or EcoTaxa login forbidden.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: EcoTaxa instance not found.
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
    /**
     * @openapi
     * /users/{user_id}/ecotaxa_account/{ecotaxa_account_id}:
     *   delete:
     *     summary: Logout from EcoTaxa account
     *     description: Unlink an EcoTaxa account from the specified user.
     *     tags: [Users]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: user_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The EcoPart user ID.
     *       - name: ecotaxa_account_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The EcoTaxa account ID to unlink.
     *     responses:
     *       200:
     *         description: Successfully logged out from EcoTaxa account.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: Unauthorized to delete this account.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used or cannot logout.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: EcoTaxa account not found.
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
    /**
     * @openapi
     * /users/{user_id}/ecotaxa_account:
     *   get:
     *     summary: List EcoTaxa accounts
     *     description: Returns a paginated list of EcoTaxa accounts linked to the specified user.
     *     tags: [Users]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: user_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The EcoPart user ID.
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     responses:
     *       200:
     *         description: Paginated list of EcoTaxa accounts.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/EcotaxaAccountSearchResponse'
     *       401:
     *         description: Unauthorized or invalid parameters.
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
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
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