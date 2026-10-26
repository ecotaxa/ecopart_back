import { ProjectRequestModel } from "../../../entities/project";
import { ProjectStatsResponseModel } from "../../../entities/project-stats";
import { UserUpdateModel } from "../../../entities/user";

export interface GetProjectStatsUseCase {
    execute(current_user: UserUpdateModel, project: ProjectRequestModel): Promise<ProjectStatsResponseModel>;
}
