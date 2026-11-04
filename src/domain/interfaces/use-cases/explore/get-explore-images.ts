import { ExploreImage, ExploreImagesRequest } from "../../../entities/explore";
import { UserUpdateModel } from "../../../entities/user";

export interface GetExploreImagesUseCase {
    execute(current_user: UserUpdateModel, request: ExploreImagesRequest): Promise<ExploreImage[]>;
}
