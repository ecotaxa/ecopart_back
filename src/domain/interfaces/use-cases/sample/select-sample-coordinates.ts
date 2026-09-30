import { PublicSampleModel } from "../../../entities/sample";
import { UserUpdateModel } from "../../../entities/user";

export interface SelectSampleCoordinatesUseCase {
    execute(current_user: UserUpdateModel, project_id: number, sample_id: number, use_ctd_coordinates: boolean): Promise<PublicSampleModel>;
}
