import { UserRequestModel } from "../../../entities/user";

export interface ResetPasswordRequestUseCase {
    execute(user: UserRequestModel): Promise<void>;
}
