import { PublicHeaderSampleResponseModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleRequestModel, SampleTypeModel, SampleTypeRequestModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel } from "../../entities/sample";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";

export interface SampleRepository {
    formatSampleToImport(base_sample: Partial<SampleRequestCreationModel>, instrument_model: string): Promise<SampleRequestCreationModel>;
    createSample(sample: SampleRequestCreationModel): Promise<number>;
    createManySamples(samples: SampleRequestCreationModel[]): Promise<number[]>;
    ensureFolderExists(root_folder_path: string): Promise<void>;
    listImportableSamples(root_folder_path: string, instrument_model: string, dest_folder: string, project_id: number): Promise<PublicHeaderSampleResponseModel[]>;
    UVP6copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void>
    UVP5copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void>
    deleteSamplesFromImportFolder(dest_folder: string, samples_names_to_import: string[]): Promise<void>
    getSample(sample: SampleRequestModel): Promise<PublicSampleModel | null>;
    deleteSample(sample: SampleIdModel): Promise<number>;
    deleteSampleFromStorage(sample_name: string, project_id: number): Promise<number>;
    standardGetSamples(options: PreparedSearchOptions): Promise<SearchResult<PublicSampleModel>>;
    getSampleType(sample_type: SampleTypeRequestModel): Promise<SampleTypeModel | null>;
    getVisualQCStatus(visual_qc_status: VisualQualityCheckStatusRequestModel): Promise<VisualQualityCheckStatusModel | null>;
}