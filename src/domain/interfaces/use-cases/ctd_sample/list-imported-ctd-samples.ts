import { UserUpdateModel } from "../../../entities/user";
import { PublicSampleModel } from "../../../entities/sample";
import { SearchResult } from "../../../entities/search";

export interface ListImportedCTDSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number): Promise<SearchResult<PublicSampleModel>>;
}
