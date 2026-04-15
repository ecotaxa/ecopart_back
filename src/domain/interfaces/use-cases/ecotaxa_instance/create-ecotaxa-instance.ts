import { EcotaxaInstanceModel, EcotaxaInstanceRequestCreationModel } from "../../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../../entities/user";
export interface CreateEcoTaxaInstanceUseCase {
    execute(current_user: UserUpdateModel, instance: EcotaxaInstanceRequestCreationModel): Promise<EcotaxaInstanceModel>;
}
