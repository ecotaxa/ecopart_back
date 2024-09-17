import { PublicSampleResponseModel } from "../../../entities/sample";
import { UserUpdateModel } from "../../../entities/user";

export interface ListImportableSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number): Promise<PublicSampleResponseModel[]>;
}