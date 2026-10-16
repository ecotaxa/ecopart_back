import { JwtPayload } from "jsonwebtoken";
import { Request } from 'express';
import { UserResponseModel } from "./user";

export interface AuthUserCredentialsModel {
    email: string;
    password: string;
}

export interface AuthJwtResponseModel {
    jwt: string;
    jwt_refresh: string
}

export interface AuthJwtRefreshedResponseModel {
    jwt: string;
    jwt_refresh: string;
}

// sid: the login session the token belongs to (absent from tokens issued before sessions existed)
export interface DecodedToken extends UserResponseModel, JwtPayload {
    sid?: string;
}

// One row per login: the refresh token is only accepted while its session is neither revoked nor expired.
export interface UserSessionModel {
    session_id: string;
    user_id: number;
    session_creation_utc_date_time: string;
    session_expiration_utc_date_time: string;
    session_revocation_utc_date_time: string | null;
}

export interface CustomRequest extends Request {
    token: DecodedToken;
}

export interface ChangeCredentialsModel {
    user_id: number;
    password?: string;
    new_password: string;
    password_hash?: string;
    reset_password_code?: string | null;
    reset_password_token?: string | null;
}
export interface ResetCredentialsModel {
    new_password: string;
    reset_password_token: string | null;
}
