import { PublicProjectRequestCreationModel, PublicProjectResponseModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";
export interface CreateProjectUseCase {
    execute(current_user: UserUpdateModel, project: PublicProjectRequestCreationModel): Promise<PublicProjectResponseModel>;
}

