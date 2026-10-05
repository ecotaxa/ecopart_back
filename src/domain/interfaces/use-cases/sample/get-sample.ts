import { PublicSampleModel } from "../../../entities/sample";
import { UserUpdateModel } from "../../../entities/user";

export interface GetSampleUseCase {
    execute(current_user: UserUpdateModel, project_id: number, sample_id: number): Promise<PublicSampleModel>;
}
