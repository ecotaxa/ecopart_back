import { UserUpdateModel } from "../../../entities/user";
export interface DeleteEcoTaxaSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number, samples_names_to_delete: string[]): Promise<void>;
}
