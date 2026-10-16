import { AuthRepository } from "../../interfaces/repositories/auth-repository";
import { LogoutUserUseCase } from "../../interfaces/use-cases/auth/logout";

export class LogoutUser implements LogoutUserUseCase {
    authRepository: AuthRepository

    constructor(authRepository: AuthRepository) {
        this.authRepository = authRepository
    }

    // Revokes the session of the refresh token, so that a copy of it stops working too. A missing, invalid
    // or expired token has nothing left to revoke.
    async execute(refresh_token: string | undefined): Promise<void> {
        if (!refresh_token) return
        const decoded = this.authRepository.decodeRefreshToken(refresh_token)
        if (decoded?.sid) await this.authRepository.revokeSession(decoded.sid)
    }
}
