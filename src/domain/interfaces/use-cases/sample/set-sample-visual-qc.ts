import { PublicSampleModel } from "../../../entities/sample";
import { UserUpdateModel } from "../../../entities/user";

export interface SetSampleVisualQcUseCase {
    execute(current_user: UserUpdateModel, project_id: number, sample_id: number, visual_qc_status_label: string, comment?: string | null): Promise<PublicSampleModel>;
}
