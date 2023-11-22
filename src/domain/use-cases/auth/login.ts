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

            // If can't find user
            if (full_user === null) throw new Error("Can't find user");
            // If founded user email is not verified
            if (!full_user.valid_email) throw new Error("User email not verified");

            // Get authorisation access and refresh tokens
            const tokens = { jwt: this.authRepository.generateAccessToken(full_user), jwt_refresh: this.authRepository.generateRefreshToken(full_user) }

            return { ...full_user, ...tokens }

        } else throw new Error("Invalid credentials");
    }
}