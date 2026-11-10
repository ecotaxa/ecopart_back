import { ExploreProjectOption } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

// current_user is null for an anonymous caller.
export interface ListExploreProjectsUseCase {
    execute(current_user: UserUpdateModel | null): Promise<ExploreProjectOption[]>;
}
