import { EcoTaxaSampleSummary, MinimalSampleRequestModel, PrivateSampleUpdateModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleTypeModel, SampleTypeRequestModel, SampleUpdateModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel, } from "../../../domain/entities/sample";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
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
}