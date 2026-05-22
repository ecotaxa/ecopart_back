import { UserUpdateModel } from "../../../entities/user";
import { ImportedCTDSampleModel } from "../../../entities/sample";

export interface ListImportedCTDSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number): Promise<ImportedCTDSampleModel[]>;
}
