
import { CryptoWrapper } from "../../infra/cryptography/crypto-wrapper";
import { UserDataSource } from "../../data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel } from "../entities/auth";
import { UserResponseModel, UserRequesCreationtModel, UserRequestModel, UserUpdateModel } from "../entities/user";
import { UserRepository } from "../interfaces/repositories/user-repository";

export class UserRepositoryImpl implements UserRepository {
    userDataSource: UserDataSource
    userCrypto: CryptoWrapper

    constructor(userDataSource: UserDataSource, userCrypto: CryptoWrapper) {
        this.userDataSource = userDataSource
        this.userCrypto = userCrypto
    }

    // TODO TEST
    async adminUpdateUser(user: UserUpdateModel): Promise<number | null> {
        const params_admin = ["id", "first_name", "last_name", "email", "status", "is_admin", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = this.updateUser(user, params_admin)
        return updated_user_nb
    }
    // TODO TEST
    async standardUpdateUser(user: UserUpdateModel): Promise<number | null> {
        const params_restricted = ["id", "first_name", "last_name", "email", "organisation", "country", "user_planned_usage"]
        const updated_user_nb = this.updateUser(user, params_restricted)
        console.log(updated_user_nb)
        return updated_user_nb
    }

    // TODO TEST
    // return number of lines updated
    private async updateUser(user: UserUpdateModel, params: string[]): Promise<number | null> {
        const filtred_user: UserUpdateModel = Object.keys(user).reduce((acc: any, key: string) => {
            if (params.includes(key)) {
                acc[key] = user[key];
            }
            return acc;
        }, {});
        console.log(filtred_user)
        if (Object.keys(filtred_user).length > 1) {
            const updated_user_nb = await this.userDataSource.updateOne(filtred_user);
            return updated_user_nb;
        } else return 0
    }

    async createUser(user: UserRequesCreationtModel): Promise<number | null> {
        user.password = await this.userCrypto.hash(user.password)
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
}