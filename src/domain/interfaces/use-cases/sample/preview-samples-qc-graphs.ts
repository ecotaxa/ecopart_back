import { SampleQcGraphsResponseModel } from "../../../entities/sample-qc-graph";
import { UserUpdateModel } from "../../../entities/user";

export interface PreviewSamplesQcGraphsUseCase {
    execute(current_user: UserUpdateModel, project_id: number, sample_names: string[]): Promise<SampleQcGraphsResponseModel[]>;
}
