
import { CryptoWrapper } from "../../infra/cryptography/crypto-wrapper";
import { UserDataSource } from "../../data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel } from "../entities/auth";
import { UserResponseModel, UserRequesCreationtModel, UserRequestModel, UserUpdateModel, UserStatus } from "../entities/user";
import { UserRepository } from "../interfaces/repositories/user-repository";

export class UserRepositoryImpl implements UserRepository {
    userDataSource: UserDataSource
    userCrypto: CryptoWrapper

    constructor(userDataSource: UserDataSource, userCrypto: CryptoWrapper) {
        this.userDataSource = userDataSource
        this.userCrypto = userCrypto
    }

    async adminUpdateUser(user: UserUpdateModel): Promise<number | null> {
        const params_admin = ["id", "first_name", "last_name", "email", "valid_email", "is_admin", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = this.updateUser(user, params_admin)
        return updated_user_nb
    }

    async standardUpdateUser(user: UserUpdateModel): Promise<number | null> {
        const params_restricted = ["id", "first_name", "last_name", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = this.updateUser(user, params_restricted)
        return updated_user_nb
    }

    // return number of lines updated
    private async updateUser(user: UserUpdateModel, params: string[]): Promise<number | null> {
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
    // TODO TEST
    async validUser(user: UserResponseModel): Promise<number | null> {
        const valid_fields = { confirmation_code: undefined, valid_email: true }
        const updated_user_nb = this.updateUser({ ...user, ...valid_fields }, ["id", "confirmation_code", "valid_email"])

        return updated_user_nb
    }

    async createUser(user: UserRequesCreationtModel): Promise<number | null> {
        user.password = await this.userCrypto.hash(user.password)
        user.confirmation_code = await this.userCrypto.generate_uuid()
        const result = await this.userDataSource.create(user)
        return result;
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

    async isAdmin(id: number): Promise<boolean> {
        const user = await this.userDataSource.getOne({ id: id })
        if (!user) return false
        return user.is_admin
    }

    // TODO TEST
    async getStatus(id: number): Promise<string | null> {
        const user = await this.userDataSource.getOne({ id: id })
        if (!user) return null

        if (user.valid_email) return UserStatus.Active
        return UserStatus.Pending
    }
}