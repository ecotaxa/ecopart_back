
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

        // Get full user by id: an admin can change an email, and the address may then belong to someone else
        const full_user = await this.userRepository.getUser({ user_id: userAuth.user_id })

        // If cannot find user
        if (full_user === null) throw new Error("Cannot find user");

        // If founded user is deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(full_user.user_id);

        // Get authorisation access token //TODO CHECK if generated token based on public user
        const refreshed_token = { jwt: this.authRepository.generateAccessToken(full_user) }
        return refreshed_token
    }
}