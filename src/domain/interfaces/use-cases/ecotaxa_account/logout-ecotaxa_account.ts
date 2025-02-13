import { UserUpdateModel } from "../../../entities/user";

export interface LogoutEcotaxaAccountUseCase {
    execute(current_user: UserUpdateModel, ecopart_user_id: number, ecotaxa_account_to_delete_id: number): Promise<void>;
}