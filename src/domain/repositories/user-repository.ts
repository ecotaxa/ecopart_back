
import { CryptoWrapper } from "../../infra/cryptography/crypto-wrapper";
import { UserDataSource } from "../../data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel, ChangeCredentialsModel, DecodedToken } from "../entities/auth";
import { UserResponseModel, UserRequesCreationtModel, UserRequestModel, UserUpdateModel, PublicUserModel, PrivateUserModel } from "../entities/user";
import { UserRepository } from "../interfaces/repositories/user-repository";
import { JwtWrapper } from "../../infra/auth/jwt-wrapper";
import { PreparedSearchOptions, PreparedSortingSearchOptions, SearchResult } from "../entities/search";

export class UserRepositoryImpl implements UserRepository {
    userDataSource: UserDataSource
    userCrypto: CryptoWrapper
    userJwt: JwtWrapper
    VALIDATION_TOKEN_SECRET: string
    RESET_PASSWORD_TOKEN_SECRET: string
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE", "BETWEEN"]

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

    async adminGetUsers(options: PreparedSearchOptions): Promise<SearchResult> {
        //can be filtered by 
        const filter_params_admin = ["user_id", "first_name", "last_name", "email", "valid_email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date", "deleted"]
        // Can be sort_by
        const sort_param_admin = ["user_id", "first_name", "last_name", "email", "valid_email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date", "deleted"]
        //const prepared_options = this.prepare_options(options)
        return await this.getUsers(options, filter_params_admin, sort_param_admin, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    async standardGetUsers(options: PreparedSearchOptions): Promise<SearchResult> {
        //can be filtered by 
        const filter_params_restricted = ["user_id", "first_name", "last_name", "email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date", "valid_email", "deleted"] // Add valid_email and deleted to force default filter
        // Can be sort_by 
        const sort_param_restricted = ["user_id", "first_name", "last_name", "email", "is_admin", "organisation", "country", "user_planned_usage", "user_creation_date"]

        // If valid email or deleted dilter delet them
        options.filter.filter(filter => filter.field === "valid_email" || filter.field === "deleted")

        options.filter.push({ field: "valid_email", operator: "=", value: true });
        options.filter.push({ field: "deleted", operator: "=", value: null });

        return await this.getUsers(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    formatSortBy(raw_sort_by: string): PreparedSortingSearchOptions[] {
        // Split the raw_sort_by string by commas to get individual sorting statements
        const prepared_sort_by = raw_sort_by.split(",").map(statement => {
            // Split the statement by "(" to separate order_by and sort_by
            const [order_by, sort_by] = statement.split("(");
            // Extract the sort_by string and remove the closing ")"
            const clean_sort_by = sort_by.slice(0, -1).toLowerCase();
            // Return an object with sort_by and order_by keys if both are non-empty
            if (clean_sort_by && order_by) {
                return { sort_by: clean_sort_by, order_by: order_by.toLowerCase() };
            }
            // Otherwise, return null
            return null;
        }).filter(Boolean); // Filter out null values
        return prepared_sort_by as PreparedSortingSearchOptions[];
    }

    private async getUsers(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult> {
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by =>
            sort_by_params.includes(sort_by.sort_by) && order_by_params.includes(sort_by.order_by)
        );

        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter =>
            filtering_params.includes(filter.field) && filter_operator_params.includes(filter.operator)
        );
        //TODO check value? or juste prepared statement after
        return await this.userDataSource.getAll(options);
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