import { PublicSampleResponseModel } from "../../entities/sample";

export interface SampleRepository {
    ensureFolderExists(root_folder_path: string): Promise<void>;
    listImportableSamples(root_folder_path: string, instrument_model: string): Promise<PublicSampleResponseModel[]>;
    copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void>
}