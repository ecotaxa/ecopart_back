
import { CryptoWrapper } from "../../infra/cryptography/crypto-wrapper";
import { UserDataSource } from "../../data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel, ChangeCredentialsModel, DecodedToken } from "../entities/auth";
import { UserResponseModel, UserRequesCreationtModel, UserRequestModel, UserUpdateModel, PublicUserModel, PrivateUserModel } from "../entities/user";
import { UserRepository } from "../interfaces/repositories/user-repository";
import { JwtWrapper } from "../../infra/auth/jwt-wrapper";
import { PreparedSearchOptions, SearchOptions, SearchResult } from "../entities/search";

export class UserRepositoryImpl implements UserRepository {
    userDataSource: UserDataSource
    userCrypto: CryptoWrapper
    userJwt: JwtWrapper
    VALIDATION_TOKEN_SECRET: string
    RESET_PASSWORD_TOKEN_SECRET: string

    constructor(userDataSource: UserDataSource, userCrypto: CryptoWrapper, userJwt: JwtWrapper, VALIDATION_TOKEN_SECRET: string, RESET_PASSWORD_TOKEN_SECRET: string) {
        this.userDataSource = userDataSource
        this.userCrypto = userCrypto
        this.userJwt = userJwt
        this.VALIDATION_TOKEN_SECRET = VALIDATION_TOKEN_SECRET
        this.RESET_PASSWORD_TOKEN_SECRET = RESET_PASSWORD_TOKEN_SECRET
    }

    // return number of lines updated
    private async updateUser(user: UserUpdateModel, params: string[]): Promise<number> {
        const filtred_user: UserUpdateModel = Object.keys(user).reduce((acc: any, key: string) => {
            if (params.includes(key)) {
                acc[key] = user[key];
            }
            return acc;
        }, {});
        if (Object.keys(filtred_user).length > 1) {
            const updated_user_nb = await this.userDataSource.updateOne(filtred_user);
            return updated_user_nb;
        } else return 0
    }

    async changePassword(credentials: ChangeCredentialsModel): Promise<number> {
        const params_password = ["user_id", "password_hash", "reset_password_code"]
        credentials.password_hash = await this.userCrypto.hash(credentials.new_password)
        credentials.reset_password_code = null
        const nb_of_updated_user = await this.updateUser(credentials, params_password)
        return nb_of_updated_user
    }

    async adminUpdateUser(user: UserUpdateModel): Promise<number> {
        const params_admin = ["user_id", "first_name", "last_name", "email", "valid_email", "confirmation_code", "is_admin", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = await this.updateUser(user, params_admin)
        return updated_user_nb
    }

    async standardUpdateUser(user: UserUpdateModel): Promise<number> {
        const params_restricted = ["user_id", "first_name", "last_name", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = await this.updateUser(user, params_restricted)
        return updated_user_nb
    }

    async validUser(user: UserResponseModel): Promise<number> {
        const valid_fields = { confirmation_code: undefined, valid_email: true }
        const updated_user_nb = await this.updateUser({ ...user, ...valid_fields }, ["user_id", "confirmation_code", "valid_email"])
        return updated_user_nb
    }

    async createUser(user: UserRequesCreationtModel): Promise<number> {
        user.password = await this.userCrypto.hash(user.password)
        user.confirmation_code = await this.userCrypto.generate_uuid()
        const result = await this.userDataSource.create(user)
        return result;
    }

    generateValidationToken(user: UserRequestModel): string {
        const token = this.userJwt.sign({ user_id: user.user_id, confirmation_code: user.confirmation_code }, this.VALIDATION_TOKEN_SECRET, { expiresIn: '24h' })
        return token
    }

    generateResetPasswordToken(user: UserRequestModel): string {
        const token = this.userJwt.sign({ user_id: user.user_id, reset_password_code: user.reset_password_code }, this.RESET_PASSWORD_TOKEN_SECRET, { expiresIn: '3h' })
        return token
    }

    async setResetPasswordCode(user: UserUpdateModel): Promise<number> {
        user.reset_password_code = await this.userCrypto.generate_uuid()
        const nb_of_updated_user = await this.updateUser(user, ["user_id", "reset_password_code"])
        return nb_of_updated_user
    }

    adminGetUsers(options: PreparedSearchOptions): Promise<SearchResult> {
        //can be filtered by ["user_id", "first_name", "last_name", "email", "valid_email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date", "deleted"]
        //const prepared_options = this.prepare_options(options)

        return this.userDataSource.getAll(options)
    }

    standardGetUsers(options: PreparedSearchOptions): Promise<SearchResult> {
        //can be filtered by ["user_id", "first_name", "last_name", "email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date"]
        //const prepared_options = this.prepare_options(options)
        // if option 
        // prepared_options.filter.deleted = undefined;
        // prepared_options.filter.valid_email = true;
        return this.userDataSource.getAll(options)
    }

    // prepare_options(options: SearchOptions): PreparedSearchOptions {
    //     const preparedOptions: PreparedSearchOptions = {
    //         // filter: options.filter || {}, // Use the provided filter or an empty object if not specified
    //         // sort: options.sort || [], // Use the provided sort or an empty array if not specified
    //         page: options.page,
    //         limit: options.limit
    //     }
    //     return preparedOptions;
    // }

    async getUsers(options: SearchOptions): Promise<SearchResult> {
        //can be filtered by ["user_id", "first_name", "last_name", "email", "valid_email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date", "deleted"]
        //can be ordred by ["user_id", "first_name", "last_name", "email", "valid_email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date", "deleted"]
        console.log("options", options)
        const preparedOptions: PreparedSearchOptions = {
            // filter: [],
            // sort: [],
            page: options.page || 1, // Add pagination support, Default to page 1 if not specified
            limit: options.limit || 10 // Set limit for pagination, Default to 10 items per page if not specified
        }
        const result = await this.userDataSource.getAll(preparedOptions)

        return result;
    }

    async getUser(user: UserRequestModel): Promise<UserResponseModel | null> {
        const result = await this.userDataSource.getOne(user)
        return result;
    }

    async verifyUserLogin(user: AuthUserCredentialsModel): Promise<boolean> {
        try {
            // Fetch user details based on the provided email 
            const userDetails = await this.userDataSource.getUserLogin(user.email);
            // Check if user details were found and passwords match
            if (userDetails && await this.userCrypto.compare(user.password, userDetails.password)) {
                // User is authenticated, return true
                return true;
            }
            // Either user details were not found or passwords didn't match, return false
            return false;
        } catch (error) {
            // An error occurred while fetching or comparing, log the error and return false
            console.log(error);
            return false;
        }
    }

    verifyValidationToken(confirmation_token: string): DecodedToken | null {
        return this.verifyToken(confirmation_token, this.VALIDATION_TOKEN_SECRET)
    }

    verifyResetPasswordToken(reset_password_token: string): DecodedToken | null {
        return this.verifyToken(reset_password_token, this.RESET_PASSWORD_TOKEN_SECRET)
    }

    // TODO IMPROVE ERROR HANDLING
    verifyToken(token: string, secret: string): DecodedToken | null {
        try {
            // Verify the token 
            const decoded = this.userJwt.verify(token, secret)

            // Attach the decoded token to the request object
            const decoded_token = (decoded as DecodedToken);

            return decoded_token
        } catch (error) {
            // An error occurred while fetching or comparing, log the error and return null
            console.log(error);
            console.log("Token invalid or expired.");
            return null;
        }
    }

    async isAdmin(user_id: number): Promise<boolean> {
        const user = await this.userDataSource.getOne({ user_id: user_id })
        if (!user) return false
        return user.is_admin
    }

    toPublicUser(createdUser: PrivateUserModel): PublicUserModel {
        const publicUser: PublicUserModel = {
            user_id: createdUser.user_id,
            first_name: createdUser.first_name,
            last_name: createdUser.last_name,
            email: createdUser.email,
            valid_email: createdUser.valid_email,
            is_admin: createdUser.is_admin,
            organisation: createdUser.organisation,
            country: createdUser.country,
            user_planned_usage: createdUser.user_planned_usage,
            user_creation_date: createdUser.user_creation_date
        }

        return publicUser
    }

    async isDeleted(user_id: number): Promise<boolean> {
        const user = await this.userDataSource.getOne({ user_id: user_id })
        if (!user) return false
        return user.deleted ? true : false
    }

    async deleteUser(user: UserUpdateModel): Promise<number> {
        const params = ["user_id", "first_name", "last_name", "email", "valid_email", "confirmation_code", "is_admin", "organisation", "country", "user_planned_usage", "password_hash", "reset_password_code", "deleted"]
        const anonymized_user: UserUpdateModel = {
            user_id: user.user_id,
            first_name: "anonym_" + user.user_id,
            last_name: "anonym_" + user.user_id,
            email: "anonym_" + user.user_id,
            valid_email: false,
            confirmation_code: null,
            is_admin: false,
            organisation: "anonymized",
            country: "anonymized",
            user_planned_usage: "anonymized",
            password_hash: "anonymized",
            reset_password_code: null,
            deleted: new Date().toISOString()
        }

        const nb_of_updated_user = await this.updateUser(anonymized_user, params)
        return nb_of_updated_user

    }
}