import { ProjectQcStateModel } from "../../../entities/project-stats";
import { UserUpdateModel } from "../../../entities/user";

export interface GetProjectsQcStatesUseCase {
    execute(current_user: UserUpdateModel, project_ids: number[]): Promise<ProjectQcStateModel[]>;
}
