import { EcotaxaInstanceModel } from "../../../entities/ecotaxa_account";
export interface GetAllEcoTaxaInstancesUseCase {
    execute(): Promise<EcotaxaInstanceModel[]>;
}
