import { ExploreImage, ExploreImagesRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

// current_user is null for an anonymous caller.
export interface GetExploreImagesUseCase {
    execute(current_user: UserUpdateModel | null, request: ExploreImagesRequest): Promise<ExploreImage[]>;
}
