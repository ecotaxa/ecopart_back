import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel } from "../../entities/project";

export interface ProjectRepository {
    createProject(project: ProjectRequestCreationtModel): Promise<number>;
    getProject(project: ProjectRequestModel): Promise<ProjectResponseModel | null>;
    computeDefaultDepthOffset(instrument: string): number | undefined;
    deleteProject(project: ProjectRequestModel): Promise<number>;
}