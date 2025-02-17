import { EcotaxaAccountModel, PublicEcotaxaAccountRequestCreationModel } from "../../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../../entities/user";

export interface LoginEcotaxaAccountUseCase {
    execute(current_user: UserUpdateModel, ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<EcotaxaAccountModel>;
}