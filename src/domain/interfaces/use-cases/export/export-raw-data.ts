import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

// One value per folder of the produced archive. `lpm`, `images` and `instrument_config` each map
// to a category of per-sample artifact (see RawFileCategory) so that asking for the particle data
// no longer drags along the vignettes or the instrument configuration.
export type RawExportType = "metadata" | "lpm" | "images" | "instrument_config" | "ctd" | "ecotaxa";

export interface ExportRawDataRequestModel {
    sample_ids: number[];
    export_types: RawExportType[];
    ecotaxa_exclude_not_living?: boolean;
    // Opt-out of the all-or-nothing visual-QC gate: when true, samples that are not VALIDATED are
    // dropped from the export (and named in the task log) instead of aborting it. Defaults to false.
    skip_not_validated?: boolean;
}

export interface ExportRawDataUseCase {
    execute(current_user: UserUpdateModel, request: ExportRawDataRequestModel): Promise<TaskResponseModel>;
}
