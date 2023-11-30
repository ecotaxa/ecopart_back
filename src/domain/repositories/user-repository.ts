
import { CryptoWrapper } from "../../infra/cryptography/crypto-wrapper";
import { UserDataSource } from "../../data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel, ChangeCredentialsModel, DecodedToken } from "../entities/auth";
import { UserResponseModel, UserRequesCreationtModel, UserRequestModel, UserUpdateModel } from "../entities/user";
import { UserRepository } from "../interfaces/repositories/user-repository";
import { JwtWrapper } from "../../infra/auth/jwt-wrapper";

export class UserRepositoryImpl implements UserRepository {
    userDataSource: UserDataSource
    userCrypto: CryptoWrapper
    userJwt: JwtWrapper
    VALIDATION_TOKEN_SECRET: string

    constructor(userDataSource: UserDataSource, userCrypto: CryptoWrapper, userJwt: JwtWrapper, VALIDATION_TOKEN_SECRET: string) {
        this.userDataSource = userDataSource
        this.userCrypto = userCrypto
        this.userJwt = userJwt
        this.VALIDATION_TOKEN_SECRET = VALIDATION_TOKEN_SECRET
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
        const params_password = ["user_id", "password_hash"]
        credentials.password_hash = await this.userCrypto.hash(credentials.new_password)
        const nb_of_updated_user = this.updateUser(credentials, params_password)
        return nb_of_updated_user
    }

    async adminUpdateUser(user: UserUpdateModel): Promise<number> {
        const params_admin = ["user_id", "first_name", "last_name", "email", "valid_email", "confirmation_code", "is_admin", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = this.updateUser(user, params_admin)
        return updated_user_nb
    }

    async standardUpdateUser(user: UserUpdateModel): Promise<number> {
        const params_restricted = ["user_id", "first_name", "last_name", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = this.updateUser(user, params_restricted)
        return updated_user_nb
    }

    async validUser(user: UserResponseModel): Promise<number> {
        const valid_fields = { confirmation_code: undefined, valid_email: true }
        const updated_user_nb = this.updateUser({ ...user, ...valid_fields }, ["user_id", "confirmation_code", "valid_email"])
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

    async getUsers(): Promise<UserResponseModel[]> {
        const result = await this.userDataSource.getAll()
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
    // TODO IMPROVE ERROR HANDLING
    verifyValidationToken(confirmation_token: string): DecodedToken | null {
        try {
            // Verify the token using the refresh secret key
            const decoded = this.userJwt.verify(confirmation_token, this.VALIDATION_TOKEN_SECRET)

            // Attach the decoded token to the request object
            const decoded_token = (decoded as DecodedToken);

            return decoded_token
        } catch (error) {
            // An error occurred while fetching or comparing, log the error and return null
            console.log(error);
            console.log(" Validation token invalid or expired.");
            return null;
        }
    }

    async isAdmin(user_id: number): Promise<boolean> {
        const user = await this.userDataSource.getOne({ user_id: user_id })
        if (!user) return false
        return user.is_admin
    }

}