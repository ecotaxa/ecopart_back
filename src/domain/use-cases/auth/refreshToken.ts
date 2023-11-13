
import { AuthJwtRefreshedResponseModel, DecodedToken } from "../../entities/auth";
import { AuthRepository } from "../../interfaces/repositories/auth-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { RefreshTokenUseCase } from "../../interfaces/use-cases/auth/refreshToken";

export class RefreshToken implements RefreshTokenUseCase {
    userRepository: UserRepository
    authRepository: AuthRepository

    constructor(userRepository: UserRepository, authRepository: AuthRepository) {
        this.userRepository = userRepository
        this.authRepository = authRepository
    }

    async execute(userAuth: DecodedToken): Promise<AuthJwtRefreshedResponseModel | null> {
        // Get full user based on decoded token user's email
        const full_user = await this.userRepository.getUser({ email: userAuth.email })
        if (full_user === null) return full_user
        // TODO check if it is pertinent
        if (!full_user.valid_email) throw new Error("User email not verified");

        // Get authorisation access token
        const refreshed_token = { jwt: this.authRepository.generateAccessToken(full_user) }
        return refreshed_token
    }
}