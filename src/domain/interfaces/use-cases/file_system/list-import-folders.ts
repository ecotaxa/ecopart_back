import { UserUpdateModel } from "../../../entities/user";

export interface ListImportFoldersUseCase {
    execute(current_user: UserUpdateModel, folder_path: string): Promise<string[]>;
}
