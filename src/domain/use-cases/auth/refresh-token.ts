
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

        // A revoked (logout, password change) or expired session cannot be refreshed any more
        await this.authRepository.ensureSessionIsActive(userAuth.sid, full_user.user_id);
        const session_id = userAuth.sid as string

        // Each refresh pushes the end of the session back and reissues the refresh token for the same session,
        // so an active user stays logged in and several tabs refreshing at once keep working
        await this.authRepository.extendSession(session_id);
        return {
            jwt: this.authRepository.generateAccessToken(full_user, session_id),
            jwt_refresh: this.authRepository.generateRefreshToken(full_user, session_id),
        }
    }
}