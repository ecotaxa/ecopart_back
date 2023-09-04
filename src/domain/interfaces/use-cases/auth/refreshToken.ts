import { AuthJwtRefreshedResponseModel, DecodedToken } from "../../../entities/auth";
export interface RefreshTokenUseCase {
    execute(userAuth: DecodedToken): Promise<AuthJwtRefreshedResponseModel | null>;
}

