import { EcoTaxaSampleSummary, ImportableCTDSampleModel, MinimalSampleRequestModel, PublicHeaderSampleResponseModel, PublicImportableEcoTaxaSampleResponseModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleRequestModel, SampleTypeModel, SampleTypeRequestModel, SampleUpdateModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel } from "../../entities/sample";
import { PerImageRecord, SampleSourceQcMetadata } from "../../entities/sample-qc-graph";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";

export interface SampleRepository {
    deleteEcoTaxaSamplesFromDb(samples: SampleIdModel[]): Promise<number>;
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
    standardGetEcoTaxaSampleSummaries(options: PreparedSearchOptions): Promise<SearchResult<EcoTaxaSampleSummary>>;
    getSampleType(sample_type: SampleTypeRequestModel): Promise<SampleTypeModel | null>;
    getVisualQCStatus(visual_qc_status: VisualQualityCheckStatusRequestModel): Promise<VisualQualityCheckStatusModel | null>;

    // EcoTaxa specific methods TO sort 
    listImportableEcoTaxaSamples(instrument_model: string, dest_folder: string, project_id: number): Promise<PublicImportableEcoTaxaSampleResponseModel[]>
    // UVP6copyEcoTaxaSamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void>;
    // UVP5copyEcoTaxaSamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void>;
    // deleteEcoTaxaSamplesFromImportFolder(dest_folder: string, samples_names_to_import: string[]): Promise<void>;
    // standardGetEcoTaxaSamples(options: PreparedSearchOptions): Promise<SearchResult<PublicSampleModel>>;
    createManyEcoTaxaSamples(samples: SampleUpdateModel[]): Promise<number>;

    // Raw-data export helpers
    getSamplesByIds(sample_ids: number[]): Promise<PublicSampleModel[]>;
    listLpmRawFilesForSample(instrument_model: string, project_id: number, sample_name: string): Promise<string[]>;
    getCTDFileAbsolutePath(project_id: number, sample_name: string, ctd_file_extension: string): string;
    countSamplesPerProject(project_ids: number[]): Promise<Map<number, number>>;
    countEcotaxaSamplesPerProject(project_ids: number[]): Promise<Map<number, number>>;
    countBlackParticulesUvp6(file_system_storage_project_folder: string, sample_name: string): Promise<number>;

    // CTD-specific methods
    listImportableCTDSamples(root_folder_path: string, instrument_model: string, project_id: number): Promise<ImportableCTDSampleModel[]>;
    importCTDSamples(root_folder_path: string, instrument_model: string, project_id: number, samples_names_to_import: string[], importator_user_id: number): Promise<void>;
    deleteImportedCTDSamplesFromDb(samples: PublicSampleModel[]): Promise<void>;
    standardUpdateManySamples(sampleData: Partial<SampleUpdateModel>, filter: MinimalSampleRequestModel): Promise<number>;

    // Import-time QC graphs
    // Reads the sample's raw files and returns one normalised record per acquired image/frame.
    getPerImageRecords(project_id: number, sample_name: string, instrument_model: string): Promise<PerImageRecord[]>;
    // Pre-import variant: reads the per-image records straight from the project source folder
    // (root_folder_path) for a sample that has not been imported yet.
    getPerImageRecordsFromSource(root_folder_path: string, sample_name: string, instrument_model: string): Promise<PerImageRecord[]>;
    // Pre-import variant: reads the filtering/settings metadata (kept range, image volume, depth
    // offset) straight from the project source folder for a not-yet-imported sample.
    getSourceFilterMetadata(root_folder_path: string, sample_name: string, instrument_model: string): Promise<SampleSourceQcMetadata>;
    // Records a visual-QC decision (status + validator + timestamp + optional comment).
    setSampleVisualQc(sample_id: number, visual_qc_status_id: number, visual_qc_validator_user_id: number, comment: string | null, validated_at: string): Promise<number>;
}