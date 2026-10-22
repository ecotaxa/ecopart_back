import { ProjectMetadataModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";

export interface GetImportFolderMetadataUseCase {
    execute(current_user: UserUpdateModel, folder_path: string): Promise<ProjectMetadataModel>;
}
