import { UserUpdateModel } from "../../../entities/user";

export interface ListImportableCTDSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number): Promise<string[]>;
}
