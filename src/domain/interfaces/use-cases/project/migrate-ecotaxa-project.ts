import { MigrateEcotaxaProjectRequestModel, MigrateEcotaxaProjectResponseModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";

export interface MigrateEcotaxaProjectUseCase {
    execute(current_user: UserUpdateModel, project_id: number, migrate_request: MigrateEcotaxaProjectRequestModel): Promise<MigrateEcotaxaProjectResponseModel>;
}
