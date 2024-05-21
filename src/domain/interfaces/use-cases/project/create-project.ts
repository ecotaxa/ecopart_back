import { PublicProjectRequestCreationtModel, PublicProjectResponseModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";
export interface CreateProjectUseCase {
    execute(current_user: UserUpdateModel, project: PublicProjectRequestCreationtModel): Promise<PublicProjectResponseModel>;
}

