import { ChangeCredentialsModel } from "../../../entities/auth";
import { UserUpdateModel } from "../../../entities/user";
export interface ChangePasswordUseCase {
    execute(current_user: UserUpdateModel, credentials: ChangeCredentialsModel): Promise<void>;
}
