import { EcoTaxaSampleSummary, MinimalSampleRequestModel, PrivateSampleUpdateModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleTypeModel, SampleTypeRequestModel, SampleUpdateModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel, } from "../../../domain/entities/sample";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
import { EcoTaxaImportedSample, ExploreSampleQuery, ExploreSampleRow, StoredEcoTaxaStats } from "../../../domain/entities/explore";
//import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
//SampleTypeModel, SampleTypeRequestModel, SampleRequestModel, SampleUpdateModel, SampleResponseModel, QualityCheckStatusRequestModel, QualityCheckStatusModel 
export interface SampleDataSource {
    createOne(sample: SampleRequestCreationModel): Promise<number>;
    createMany(samples: SampleRequestCreationModel[]): Promise<number[]>;
    getOne(sample: MinimalSampleRequestModel): Promise<PublicSampleModel | null>;
    deleteOne(sample: SampleIdModel): Promise<number>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<PublicSampleModel>>;
    getEcoTaxaSampleSummaries(options: PreparedSearchOptions): Promise<SearchResult<EcoTaxaSampleSummary>>;
    updateOne(sample: PrivateSampleUpdateModel): Promise<number>;
    updateMany(sampleData: Partial<SampleUpdateModel>, filter: MinimalSampleRequestModel): Promise<number>;
    getSampleType(sampleType: SampleTypeRequestModel): Promise<SampleTypeModel | null>;
    getVisualQCStatus(visualQCStatus: VisualQualityCheckStatusRequestModel): Promise<VisualQualityCheckStatusModel | null>;
    deleteOneEcoTaxaSample(sample: SampleIdModel): Promise<number>;
    // The light rows of the Explore selection, every matching sample, ordered by id.
    getExploreSamples(query: ExploreSampleQuery): Promise<ExploreSampleRow[]>;
    // Samples per project (one GROUP BY); null covers every project. Projects without samples are absent.
    countSamplesPerProject(project_ids: number[] | null): Promise<Map<number, number>>;
    // EcoTaxa classification counts kept per sample (table sample_ecotaxa_stats).
    getEcoTaxaStats(sample_ids: number[]): Promise<StoredEcoTaxaStats[]>;
    upsertEcoTaxaStats(stats: StoredEcoTaxaStats[]): Promise<void>;
    // Every sample imported in EcoTaxa, with the date its stats were last read (null when never).
    listEcoTaxaImportedSamples(): Promise<(EcoTaxaImportedSample & { fetched_utc_date_time: string | null })[]>;
}