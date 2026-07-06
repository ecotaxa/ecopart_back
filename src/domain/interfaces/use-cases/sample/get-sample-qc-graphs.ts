import { SampleQcGraphsResponseModel } from "../../../entities/sample-qc-graph";
import { UserUpdateModel } from "../../../entities/user";

export interface GetSampleQcGraphsUseCase {
    execute(current_user: UserUpdateModel, project_id: number, sample_id: number): Promise<SampleQcGraphsResponseModel>;
}
