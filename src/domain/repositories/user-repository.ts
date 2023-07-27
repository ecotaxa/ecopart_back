
import { CryptoWrapper } from "../../infra/cryptography/crypto-wrapper";
import { UserDataSource } from "../../data/interfaces/data-sources/user-data-source";
import { UserResponseModel, UserRequestModel } from "../entities/user";
import { UserRepository } from "../interfaces/repositories/user-repository";

export class UserRepositoryImpl implements UserRepository {
    userDataSource: UserDataSource
    userCrypto: CryptoWrapper

    constructor(userDataSource: UserDataSource, userCrypto: CryptoWrapper) {
        this.userDataSource = userDataSource
        this.userCrypto = userCrypto
    }

    async createUser(user: UserRequestModel): Promise<number> {
        user.password = await this.userCrypto.hash(user.password)
        const result = await this.userDataSource.create(user)
        return result;
    }

    async getUsers(): Promise<UserResponseModel[]> {
        const result = await this.userDataSource.getAll()
        return result;
    }
    async getUser(id: number): Promise<UserResponseModel | null> {
        console.log("getUser", id)
        const result = await this.userDataSource.getOne(id)
        console.log(result)
        return result;
    }
}