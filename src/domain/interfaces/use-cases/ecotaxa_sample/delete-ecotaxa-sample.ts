import { UserUpdateModel } from "../../../entities/user";
export interface DeleteEcoTaxaSampleUseCase {
    execute(current_user: UserUpdateModel, sample_id_to_delete: number, project_id: number): Promise<void>;
}