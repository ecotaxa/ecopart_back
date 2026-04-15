import { ProjectMetadataModel } from "../../../entities/project";

export interface GetImportFolderMetadataUseCase {
    execute(folder_path: string): Promise<ProjectMetadataModel>;
}
