import { SampleRequestCreationModel, PublicHeaderSampleResponseModel, PublicSampleModel, SampleTypeModel, VisualQualityCheckStatusModel } from "../../src/domain/entities/sample";
import { SearchResult } from "../../src/domain/entities/search";
import { SampleRepository } from "../../src/domain/interfaces/repositories/sample-repository";

export class MockSampleRepository implements SampleRepository {
    formatSampleToImport(): Promise<SampleRequestCreationModel> {
        throw new Error("Method not implemented for formatSampleToImport");
    }
    createSample(): Promise<number> {
        throw new Error("Method not implemented  for createSample");
    }
    createManySamples(): Promise<number[]> {
        throw new Error("Method not implemented for createManySamples");
    }
    ensureFolderExists(): Promise<void> {
        throw new Error("Method not implemented for ensureFolderExists");
    }
    listImportableSamples(): Promise<PublicHeaderSampleResponseModel[]> {
        throw new Error("Method not implemented for listImportableSamples");
    }
    UVP6copySamplesToImportFolder(): Promise<void> {
        throw new Error("Method not implemented for UVP6copySamplesToImportFolder");
    }
    UVP5copySamplesToImportFolder(): Promise<void> {
        throw new Error("Method not implemented for UVP5copySamplesToImportFolder");
    }
    deleteSamplesFromImportFolder(): Promise<void> {
        throw new Error("Method not implemented for deleteSamplesFromImportFolder");
    }
    getSample(): Promise<PublicSampleModel | null> {
        throw new Error("Method not implemented for getSample");
    }
    deleteSample(): Promise<number> {
        throw new Error("Method not implemented for deleteSample");
    }
    deleteSampleFromStorage(): Promise<number> {
        throw new Error("Method not implemented for deleteSampleFromStorage");
    }
    standardGetSamples(): Promise<SearchResult<PublicSampleModel>> {
        throw new Error("Method not implemented for standardGetSamples");
    }
    getSampleType(): Promise<SampleTypeModel | null> {
        throw new Error("Method not implemented for getSampleType");
    }
    getVisualQCStatus(): Promise<VisualQualityCheckStatusModel | null> {
        throw new Error("Method not implemented for getVisualQCStatus");
    }
    deleteEcoTaxaSamplesFromDb(): Promise<number> {
        throw new Error("Method not implemented for deleteEcoTaxaSamplesFromDb");
    }
    listImportableEcoTaxaSamples(): Promise<any[]> {
        throw new Error("Method not implemented for listImportableEcoTaxaSamples");
    }
    createManyEcoTaxaSamples(): Promise<number> {
        throw new Error("Method not implemented for createManyEcoTaxaSamples");
    }
    listImportableCTDSamples(): Promise<string[]> {
        throw new Error("Method not implemented for listImportableCTDSamples");
    }
    importCTDSamples(): Promise<void> {
        throw new Error("Method not implemented for importCTDSamples");
    }
    deleteImportedCTDSamplesFromDb(): Promise<void> {
        throw new Error("Method not implemented for deleteImportedCTDSamplesFromDb");
    }
}

// export class DeleteSample implements DeleteSampleUseCase