
import { UserResponseModel } from "../../entities/user";
export interface AuthRepository {
    generateAccessToken(user: UserResponseModel): string;
    generateRefreshToken(user: UserResponseModel): string;
}