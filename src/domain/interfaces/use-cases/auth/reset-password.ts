import { ChangeCredentialsModel } from "../../../entities/auth";
export interface ResetPasswordUseCase {
    execute(credentials: ChangeCredentialsModel): Promise<void>;
}
