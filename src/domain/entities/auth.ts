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
}

export interface DecodedToken extends UserResponseModel, JwtPayload { }

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
