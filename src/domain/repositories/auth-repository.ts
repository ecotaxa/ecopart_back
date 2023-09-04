import { UserResponseModel } from "../entities/user";
import { AuthRepository } from "../interfaces/repositories/auth-repository";
import { JwtAdapter } from "../../infra/auth/jsonwebtoken";

export class AuthRepositoryImpl implements AuthRepository {

    jwt: JwtAdapter
    ACCESS_TOKEN_SECRET: string
    REFRESH_TOKEN_SECRET: string

    constructor(jwtAdapter: JwtAdapter, ACCESS_TOKEN_SECRET: string, REFRESH_TOKEN_SECRET: string) {
        this.jwt = jwtAdapter
        this.ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET
        this.REFRESH_TOKEN_SECRET = REFRESH_TOKEN_SECRET
    }

    generateAccessToken(user: UserResponseModel): string {
        // creating a JWT token
        const token = this.jwt.sign(user, this.ACCESS_TOKEN_SECRET, { expiresIn: '1800s' })
        return token
    }
    generateRefreshToken(user: UserResponseModel): string {
        // creating a JWT token
        const token = this.jwt.sign(user, this.REFRESH_TOKEN_SECRET, { expiresIn: '1y' })
        return token
    }

}
