import { UserResponseModel } from "../entities/user";
import { AuthRepository } from "../interfaces/repositories/auth-repository";
import { JwtAdapter } from "../../infra/auth/jsonwebtoken";

// The front refreshes the access token on any 401, so a short lifetime costs the user nothing.
export const ACCESS_TOKEN_LIFETIME = '1h'
export const REFRESH_TOKEN_LIFETIME = '1y'

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
        return this.jwt.sign(this.toTokenPayload(user), this.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_LIFETIME })
    }
    generateRefreshToken(user: UserResponseModel): string {
        return this.jwt.sign(this.toTokenPayload(user), this.REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_LIFETIME })
    }

    // A JWT is only signed, not encrypted: single-use codes and admin-only lists must not travel in it.
    private toTokenPayload(user: UserResponseModel): object {
        const { confirmation_code, reset_password_code, managing_projects, member_projects, ...payload } = user
        return payload
    }

}
