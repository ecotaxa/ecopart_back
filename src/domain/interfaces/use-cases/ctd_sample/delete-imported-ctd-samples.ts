import { UserUpdateModel } from "../../../entities/user";

export interface DeleteImportedCTDSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number, samples_names: string[]): Promise<void>;
}
