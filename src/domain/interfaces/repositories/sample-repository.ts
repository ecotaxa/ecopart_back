import { EcoTaxaSampleSummary, ImportableCTDSampleModel, MinimalSampleRequestModel, PublicHeaderSampleResponseModel, PublicImportableEcoTaxaSampleResponseModel, PublicSampleModel, RawFileCategory, SampleIdModel, SampleRequestCreationModel, SampleRequestModel, SampleTypeModel, SampleTypeRequestModel, SampleUpdateModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel, SampleParticleStats, Uvp5WorkFilesCheckModel } from "../../entities/sample";
import { PerImageColumns, SampleSourceQcMetadata } from "../../entities/sample-qc-graph";
import { Uvp5PivotReport, Uvp5PivotSampleMetadata } from "../../entities/pivot";
import { PivotImageRecord } from "../../entities/binned-export";
import { EcoTaxaImportedSample, ExploreSampleQuery, ExploreSampleRow, StoredEcoTaxaStats } from "../../entities/explore";
import { ProjectStatsSampleRow } from "../../entities/project-stats";
import { CtdRows } from "../../entities/ctd";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { TaskLogger } from "./task-repository";

export interface SampleRepository {
    deleteEcoTaxaSamplesFromDb(samples: SampleIdModel[]): Promise<number>;
    formatSampleToImport(base_sample: Partial<SampleRequestCreationModel>, instrument_model: string, root_folder_path: string): Promise<SampleRequestCreationModel>;
    createSample(sample: SampleRequestCreationModel): Promise<number>;
    createManySamples(samples: SampleRequestCreationModel[]): Promise<number[]>;
    ensureFolderExists(root_folder_path: string): Promise<void>;
    // inspected: only these samples have their vignettes counted and their own metadata checked for
    // qc_lvl1, the others report 0 vignettes (all when omitted).
    listImportableSamples(root_folder_path: string, instrument_model: string, dest_folder: string, project_id: number, inspected?: string[]): Promise<PublicHeaderSampleResponseModel[]>;
    // Reason, per sample name, why listImportableSamples leaves it out.
    explainNotImportableSamples(root_folder_path: string, dest_folder: string, project_id: number, samples_names: string[]): Promise<Map<string, string>>;
    UVP6copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[], log: TaskLogger): Promise<void>
    UVP5copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[], log: TaskLogger): Promise<void>
    deleteSamplesFromImportFolder(dest_folder: string, samples_names_to_import: string[]): Promise<string[]>
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
    listRawFilesForSample(instrument_model: string, project_id: number, sample_name: string, category: RawFileCategory): Promise<string[]>;
    getCTDFileAbsolutePath(project_id: number, sample_name: string, ctd_file_extension: string): string;
    countSamplesPerProject(project_ids: number[] | null): Promise<Map<number, number>>;
    countEcotaxaSamplesPerProject(project_ids: number[]): Promise<Map<number, number>>;
    countBlackParticulesUvp6(file_system_storage_project_folder: string, sample_name: string): Promise<number>;

    // CTD-specific methods
    listImportableCTDSamples(root_folder_path: string, instrument_model: string, project_id: number): Promise<ImportableCTDSampleModel[]>;
    importCTDSamples(root_folder_path: string, instrument_model: string, project_id: number, samples_names_to_import: string[], importator_user_id: number, import_task_id: number, log?: TaskLogger): Promise<void>;
    deleteImportedCTDSamplesFromDb(samples: PublicSampleModel[]): Promise<void>;
    standardUpdateManySamples(sampleData: Partial<SampleUpdateModel>, filter: MinimalSampleRequestModel): Promise<number>;

    // Import-time QC graphs
    // Reads the sample's raw files and returns one normalised record per acquired image/frame, in columns.
    getPerImageRecords(project_id: number, sample_name: string, instrument_model: string): Promise<PerImageColumns>;
    // Pre-import variant: reads the per-image records straight from the project source folder
    // (root_folder_path) for a sample that has not been imported yet.
    getPerImageRecordsFromSource(root_folder_path: string, sample_name: string, instrument_model: string): Promise<PerImageColumns>;
    // Pre-import variant: reads the filtering/settings metadata (kept range, image volume, depth
    // offset) straight from the project source folder for a not-yet-imported sample.
    getSourceFilterMetadata(root_folder_path: string, sample_name: string, instrument_model: string): Promise<SampleSourceQcMetadata>;
    // Pre-import variant: max raw pressure of the particle file in the project source folder, null
    // when no line has a readable pressure.
    getSourceMaxPressure(root_folder_path: string, sample_name: string, instrument_model: string): Promise<number | null>;
    // UVP5 pre-import check: which of the files read after the copy (datfile, HDR*.txt, .bru) the
    // work entry of the sample lacks. Only the work entry is looked at.
    checkUvp5WorkFiles(root_folder_path: string, sample_name: string): Promise<Uvp5WorkFilesCheckModel>;
    // Records a visual-QC decision (status + validator + timestamp + optional comment).
    setSampleVisualQc(sample_id: number, visual_qc_status_id: number, visual_qc_validator_user_id: number, comment: string | null, validated_at: string): Promise<number>;

    // UVP5 → UVP6 pivot
    // Converts the stored work.zip of a UVP5 sample into <sample>/pivot/<sample>_Particule.zip.
    // Throws an explicit "Cannot build the UVP5 pivot of sample …" error naming the fix.
    generateUvp5Pivot(project_id: number, sample: Uvp5PivotSampleMetadata, instrument_model: string, root_folder_path: string): Promise<Uvp5PivotReport>;
    // converter_version recorded in the sample's pivot, null when it has none.
    getPivotConverterVersion(project_id: number, sample_name: string): Promise<string | null>;
    // The UVP6-format particle file the computed products read (the pivot for a UVP5 sample, the
    // imported particules.csv for a UVP6), read in two passes, see PivotImages.
    getPivotImages(project_id: number, sample_name: string, instrument_model: string): Promise<PivotImages>;

    // Explore
    // Every sample matching the query, as light rows (one query).
    getExploreSamples(query: ExploreSampleQuery): Promise<ExploreSampleRow[]>;
    // Every sample of a project as the light rows of its statistics (one query).
    getProjectStatsSamples(project_id: number): Promise<ProjectStatsSampleRow[]>;
    // Size and modification time of the sample's pivot ("<size>-<mtime_ms>"), null when it has none:
    // a cache key that changes whenever the file is rewritten.
    getPivotFileStamp(project_id: number, sample_name: string, instrument_model: string): Promise<string | null>;
    // The rows of the sample's imported CTD file (see CtdRows).
    getCtdRows(project_id: number, sample_name: string, ctd_file_extension: string): Promise<CtdRows>;
    // Particle statistics of a sample (nb_particles, extreme areas), written after its pivot is read.
    updateParticleStats(sample_id: number, stats: SampleParticleStats): Promise<number>;
    // EcoTaxa classification counts kept per sample, read and refreshed by the Explore EcoTaxa service.
    getEcoTaxaStats(sample_ids: number[]): Promise<StoredEcoTaxaStats[]>;
    saveEcoTaxaStats(stats: StoredEcoTaxaStats[]): Promise<void>;
    listEcoTaxaImportedSamples(): Promise<(EcoTaxaImportedSample & { fetched_utc_date_time: string | null })[]>;
}

// A sample's pivot read in two passes, so that a mooring of millions of images is never held in
// memory: its columns, read once up front, then its rows one by one (blocks and mean grey
// included), read again from the file each time rows() is called, in the order of the columns.
export interface PivotImages {
    columns: PerImageColumns;
    rows(): AsyncIterable<PivotImageRecord>;
}