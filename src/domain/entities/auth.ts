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
