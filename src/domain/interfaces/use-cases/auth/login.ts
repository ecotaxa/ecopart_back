import { AuthJwtResponseModel, AuthUserCredentialsModel } from "../../../entities/auth";
import { UserResponseModel } from "../../../entities/user";
export interface LoginUserUseCase {
    execute(user: AuthUserCredentialsModel): Promise<(UserResponseModel & AuthJwtResponseModel) | null>;
}

