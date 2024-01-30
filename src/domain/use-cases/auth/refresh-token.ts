
import { AuthJwtRefreshedResponseModel, DecodedToken } from "../../entities/auth";
import { AuthRepository } from "../../interfaces/repositories/auth-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { RefreshTokenUseCase } from "../../interfaces/use-cases/auth/refresh-token";

export class RefreshToken implements RefreshTokenUseCase {
    userRepository: UserRepository
    authRepository: AuthRepository

    constructor(userRepository: UserRepository, authRepository: AuthRepository) {
        this.userRepository = userRepository
        this.authRepository = authRepository
    }

    async execute(userAuth: DecodedToken): Promise<AuthJwtRefreshedResponseModel> {
        // User should not be deleted
        if (await this.userRepository.isDeleted(userAuth.user_id)) throw new Error("User is deleted");

        // Get full user based on decoded token user's email
        const full_user = await this.userRepository.getUser({ email: userAuth.email })

        // If can't find user
        if (full_user === null) throw new Error("Can't find user");

        // Get authorisation access token
        const refreshed_token = { jwt: this.authRepository.generateAccessToken(full_user) }
        return refreshed_token
    }
}