import { EcoTaxaSampleSummary, SampleRequestCreationModel, PublicHeaderSampleResponseModel, PublicSampleModel, SampleTypeModel, VisualQualityCheckStatusModel } from "../../src/domain/entities/sample";
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
    standardGetEcoTaxaSampleSummaries(): Promise<SearchResult<EcoTaxaSampleSummary>> {
        throw new Error("Method not implemented for standardGetEcoTaxaSampleSummaries");
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
    listImportableCTDSamples(): Promise<import("../../src/domain/entities/sample").ImportableCTDSampleModel[]> {
        throw new Error("Method not implemented for listImportableCTDSamples");
    }
    importCTDSamples(): Promise<void> {
        throw new Error("Method not implemented for importCTDSamples");
    }
    deleteImportedCTDSamplesFromDb(): Promise<void> {
        throw new Error("Method not implemented for deleteImportedCTDSamplesFromDb");
    }
    standardUpdateManySamples(): Promise<number> {
        throw new Error("Method not implemented for standardUpdateManySamples");
    }
    getSamplesByIds(): Promise<PublicSampleModel[]> {
        throw new Error("Method not implemented for getSamplesByIds");
    }
    listLpmRawFilesForSample(): Promise<string[]> {
        throw new Error("Method not implemented for listLpmRawFilesForSample");
    }
    getCTDFileAbsolutePath(): string {
        throw new Error("Method not implemented for getCTDFileAbsolutePath");
    }
    countSamplesPerProject(): Promise<Map<number, number>> {
        throw new Error("Method not implemented for countSamplesPerProject");
    }
    countEcotaxaSamplesPerProject(): Promise<Map<number, number>> {
        throw new Error("Method not implemented for countEcotaxaSamplesPerProject");
    }
    countBlackParticulesUvp6(): Promise<number> {
        throw new Error("Method not implemented for countBlackParticulesUvp6");
    }
}

// export class DeleteSample implements DeleteSampleUseCase