import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export type RawExportType = "metadata" | "lpm" | "ctd" | "ecotaxa";

export interface ExportRawDataRequestModel {
    sample_ids: number[];
    export_types: RawExportType[];
    ecotaxa_exclude_not_living?: boolean;
}

export interface ExportRawDataUseCase {
    execute(current_user: UserUpdateModel, request: ExportRawDataRequestModel): Promise<TaskResponseModel>;
}
