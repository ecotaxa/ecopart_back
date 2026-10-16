import { AuthUserCredentialsModel, AuthJwtResponseModel } from "../../entities/auth";
import { UserResponseModel } from "../../entities/user";
import { AuthRepository } from "../../interfaces/repositories/auth-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { LoginUserUseCase } from "../../interfaces/use-cases/auth/login";

export class LoginUser implements LoginUserUseCase {
    userRepository: UserRepository
    authRepository: AuthRepository

    constructor(userRepository: UserRepository, authRepository: AuthRepository) {
        this.userRepository = userRepository
        this.authRepository = authRepository
    }

    async execute(user: AuthUserCredentialsModel): Promise<(UserResponseModel & AuthJwtResponseModel)> {
        // Authenticate user  
        const verifyed = await this.userRepository.verifyUserLogin(user)

        if (verifyed === true) {
            // Get full user
            const full_user = await this.userRepository.getUser({ email: user.email })

            // If cannot find user
            if (full_user === null) throw new Error("Cannot find user");

            // If founded user is deleted or not validated
            await this.userRepository.ensureUserCanBeUsed(full_user.user_id);

            // If founded user email is not verified
            if (!full_user.valid_email) throw new Error("User email not verified");

            // One session per login: logging out or changing the password revokes it
            const session_id = await this.authRepository.createSession(full_user.user_id)
            const tokens = { jwt: this.authRepository.generateAccessToken(full_user, session_id), jwt_refresh: this.authRepository.generateRefreshToken(full_user, session_id) }

            const { confirmation_code, reset_password_code, ...user_without_codes } = full_user
            return { ...user_without_codes, ...tokens }

        } else throw new Error("Invalid credentials");
    }
}