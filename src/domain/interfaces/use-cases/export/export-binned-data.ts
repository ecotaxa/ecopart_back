import { BinnedExportBinMode } from "../../../entities/binned-export";
import { ExportTableFormat } from "../../../entities/export";
import { PublicTaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface ExportBinnedDataRequestModel {
    sample_ids: number[];
    bin_mode?: BinnedExportBinMode;    // default "auto"
    bin_size_m?: number;               // depth step, default 5 m
    bin_size_h?: number;               // time step, default 1 h
    // Same opt-out of the visual-QC gate as the raw export.
    skip_not_validated?: boolean;
    // Format of the three tables (`metadata/`, particles): "tsv" (default) or "parquet".
    format?: ExportTableFormat;
}

export interface ExportBinnedDataUseCase {
    execute(current_user: UserUpdateModel, request: ExportBinnedDataRequestModel): Promise<PublicTaskResponseModel>;
}
