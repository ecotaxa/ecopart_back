import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface ImportSamplesUseCase {
    // `validated_samples` (a subset of `samples_names`) are marked VALIDATED right after creation
    // — they were quality-checked via the pre-import QC preview. The rest stay PENDING.
    execute(current_user: UserUpdateModel, project_id: number, samples_names: string[], validated_samples?: string[]): Promise<TaskResponseModel>;
}