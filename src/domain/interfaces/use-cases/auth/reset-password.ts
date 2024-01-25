import { ResetCredentialsModel } from "../../../entities/auth";
export interface ResetPasswordUseCase {
    execute(credentials: ResetCredentialsModel): Promise<void>;
}
