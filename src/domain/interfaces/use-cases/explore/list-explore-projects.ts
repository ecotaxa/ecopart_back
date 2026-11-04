import { ExploreProjectOption } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

export interface ListExploreProjectsUseCase {
    execute(current_user: UserUpdateModel): Promise<ExploreProjectOption[]>;
}
