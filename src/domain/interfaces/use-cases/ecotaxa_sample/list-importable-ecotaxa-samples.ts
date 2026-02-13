import { PublicImportableEcoTaxaSampleResponseModel } from "../../../entities/sample";
import { UserUpdateModel } from "../../../entities/user";

export interface ListImportableEcoTaxaSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number): Promise<PublicImportableEcoTaxaSampleResponseModel[]>;
}