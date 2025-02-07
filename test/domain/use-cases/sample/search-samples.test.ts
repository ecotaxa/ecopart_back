import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockSearchRepository } from "../../../mocks/search-mock";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { SearchSamples } from "../../../../src/domain/use-cases/sample/search-samples";
import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";
import { InstrumentModelRepository } from "../../../../src/domain/interfaces/repositories/instrument_model-repository";
import { SearchOptions, FilterSearchOptions } from "../../../../src/domain/entities/search";
import { sampleModel_1 } from "../../../entities/sample";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockSearchRepository: SearchRepository;
let mockInstrumentRepository: InstrumentModelRepository;
let searchSamplesUseCase: SearchSamples;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockSampleRepository = new MockSampleRepository()
    mockSearchRepository = new MockSearchRepository()
    mockInstrumentRepository = new MockInstrumentModelRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()

    searchSamplesUseCase = new SearchSamples(mockUserRepository, mockSampleRepository, mockSearchRepository, mockInstrumentRepository, mockPrivilegeRepository);
})

describe("Search Task Use Case", () => {
    describe("error cases", () => {
        test("deleted or invalid user should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                limit: 10,
                page: 1,
                sort_by: []
            }
            const filters: FilterSearchOptions[] = []
            const outputError = new Error("User cannot be used")

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(outputError))
            jest.spyOn(mockSearchRepository, "formatFilters")
            jest.spyOn(mockSearchRepository, "formatSortBy")
            jest.spyOn(mockSampleRepository, "getSampleType")
            jest.spyOn(mockSampleRepository, "getVisualQCStatus")
            jest.spyOn(mockSampleRepository, "standardGetSamples")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchSamplesUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(0)
            expect(mockSampleRepository.getSampleType).toBeCalledTimes(0)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)
        });

        test("search options with invalid Filters should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: []
            }
            const outputError = new Error("Any error")
            const filters = [{ field: "task_status", operator: "=" }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { throw outputError })
            jest.spyOn(mockSearchRepository, "formatSortBy")
            jest.spyOn(mockSampleRepository, "getSampleType")
            jest.spyOn(mockSampleRepository, "getVisualQCStatus")
            jest.spyOn(mockSampleRepository, "standardGetSamples")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchSamplesUseCase.execute(current_user, options, filters as any)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(0)
            expect(mockSampleRepository.getSampleType).toBeCalledTimes(0)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)

        });
        test("search options with invalid SortBy should not be able to search for tasks", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                // sort_by: "asc(user_id)"
                sort_by: "toto"
            }
            const outputError = new Error("Any error")
            const filters = [{ field: "task_id", operator: "=", value: 1 }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { throw outputError })
            jest.spyOn(mockSampleRepository, "getSampleType")
            jest.spyOn(mockSampleRepository, "getVisualQCStatus")
            jest.spyOn(mockSampleRepository, "standardGetSamples")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchSamplesUseCase.execute(current_user, options, filters as any)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)

            expect(mockSampleRepository.getSampleType).toBeCalledTimes(0)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)

        });
        test("search options with invalid sample type should not be able to search for samples", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("Sample type not found")
            const filters = [{ field: "sample_type_label", operator: "=", value: "toto" }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockSampleRepository, "getSampleType").mockResolvedValue(null)
            jest.spyOn(mockSampleRepository, "getVisualQCStatus")
            jest.spyOn(mockSampleRepository, "standardGetSamples")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchSamplesUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)

            expect(mockSampleRepository.getSampleType).toBeCalledTimes(1)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)
        });
        test("search options with invalid visual qc status should not be able to search for samples", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("Visual QC status not found")
            const filters = [{ field: "sample_type_label", operator: "=", value: "toto" }, { field: "visual_qc_status_label", operator: "=", value: "toto" }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockSampleRepository, "getSampleType").mockResolvedValue({ sample_type_id: 1, sample_type_label: "Time", sample_type_description: "description" })
            jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue(null)
            jest.spyOn(mockSampleRepository, "standardGetSamples")
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchSamplesUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)

            expect(mockSampleRepository.getSampleType).toBeCalledTimes(1)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(1)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)
        });
        test("errors during get samples, should not be able to search for samples", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("any error")
            const filters = [{ field: "sample_type_label", operator: "=", value: "Time" }]

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockSampleRepository, "getSampleType").mockResolvedValue({ sample_type_id: 1, sample_type_label: "Time", sample_type_description: "description" })
            jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue({ visual_qc_status_id: 1, visual_qc_status_label: "PENDING" })
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockRejectedValue(outputError)
            jest.spyOn(mockSearchRepository, "formatSearchInfo")

            await expect(searchSamplesUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)

            expect(mockSampleRepository.getSampleType).toBeCalledTimes(1)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(0)
        });
        test("errors during formatSearchInfo, should not be able to search for samples", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const outputError = new Error("any error")
            const filters = [{ field: "sample_type_label", operator: "=", value: "Time" }]

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockSampleRepository, "getSampleType").mockResolvedValue({ sample_type_id: 1, sample_type_label: "Time", sample_type_description: "description" })
            jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue({ visual_qc_status_id: 1, visual_qc_status_label: "PENDING" })
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ total: 0, items: [] })
            jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { throw outputError })

            await expect(searchSamplesUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)

            expect(mockSampleRepository.getSampleType).toBeCalledTimes(1)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(1)
        });
    });
    describe("success cases", () => {
        test("search samples with no filters", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters")
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockSampleRepository, "getSampleType")
            jest.spyOn(mockSampleRepository, "getVisualQCStatus")
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ total: 0, items: [] })
            jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => ({ total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 }));

            await expect(searchSamplesUseCase.execute(current_user, options, [])).resolves.toEqual({ search_info: { total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 }, samples: [] })

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockSampleRepository.getSampleType).toBeCalledTimes(0)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(1)
        });
        test("search samples with project_id ", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters")
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockSampleRepository, "getSampleType")
            jest.spyOn(mockSampleRepository, "getVisualQCStatus")
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ total: 0, items: [] })
            jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => ({ total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 }));

            await expect(searchSamplesUseCase.execute(current_user, options, [], 1)).resolves.toEqual({ search_info: { total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 }, samples: [] })

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(0)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)
            expect(mockSampleRepository.getSampleType).toBeCalledTimes(0)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(0)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(1)
        });
        test("search samples with filters visual_qc_status_id ", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const options: SearchOptions = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }

            const filters = [{ field: "visual_qc_status_label", operator: "=", value: "toto" }]


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => filters)
            jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => [{ sort_by: "field1", order_by: "asc" }])
            jest.spyOn(mockSampleRepository, "getSampleType").mockResolvedValue({ sample_type_id: 1, sample_type_label: "Time", sample_type_description: "description" })
            jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue({ visual_qc_status_id: 1, visual_qc_status_label: "PENDING" })
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ total: 1, items: [sampleModel_1] })
            jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => ({ total: 1, limit: 10, total_on_page: 1, page: 1, pages: 0 }));

            await expect(searchSamplesUseCase.execute(current_user, options, filters)).resolves.toEqual({ search_info: { total: 1, limit: 10, total_on_page: 1, page: 1, pages: 0 }, samples: [sampleModel_1] })

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockSearchRepository.formatFilters).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSortBy).toBeCalledTimes(1)

            expect(mockSampleRepository.getSampleType).toBeCalledTimes(0)
            expect(mockSampleRepository.getVisualQCStatus).toBeCalledTimes(1)
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(1)
            expect(mockSearchRepository.formatSearchInfo).toBeCalledTimes(1)
        });
    });
});
