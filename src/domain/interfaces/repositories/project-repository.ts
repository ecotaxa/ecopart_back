import { InstrumentModelResponseModel } from "../../entities/instrument_model";
import { PublicPrivilege } from "../../entities/privilege";
import { ProjectRequestCreationModel, ProjectRequestModel, ProjectUpdateModel, ProjectResponseModel, PublicProjectResponseModel, PublicProjectRequestCreationModel } from "../../entities/project";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";

export interface ProjectRepository {
    createProjectRootFolder(root_folder_path: string): Promise<void>;
    formatProjectRequestCreationModel(public_project: PublicProjectRequestCreationModel, instrument: InstrumentModelResponseModel): ProjectRequestCreationModel;
    toPublicProject(project: ProjectResponseModel, privileges: PublicPrivilege): PublicProjectResponseModel;
    standardUpdateProject(project_to_update: ProjectUpdateModel): Promise<number>;
    createProject(project: ProjectRequestCreationModel): Promise<number>;
    getProject(project: ProjectRequestModel): Promise<ProjectResponseModel | null>;
    computeDefaultDepthOffset(instrument_model: string): number | undefined;
    deleteProject(project: ProjectRequestModel): Promise<number>;
    standardGetProjects(options: PreparedSearchOptions): Promise<SearchResult<ProjectResponseModel>>;
    ensureFolderStructureForBackup(root_folder_path: string): Promise<void>;
    copyL0bToProjectFolder(source_folder: string, dest_folder: string, skip_already_imported: boolean): Promise<void>;
    ensureBackupExist(project_id: number): Promise<void>;
    exportBackupedProjectToFtp(project: ProjectResponseModel, task_id: number): Promise<string>;
    exportBackupedProjectToFs(project: ProjectResponseModel, task_id: number): Promise<string>;
}