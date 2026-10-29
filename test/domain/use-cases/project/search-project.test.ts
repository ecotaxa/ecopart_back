import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SearchProject } from '../../../../src/domain/use-cases/project/search-projects'

import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSearchRepository } from "../../../mocks/search-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { FilterSearchOptions, SearchOptions } from "../../../../src/domain/entities/search";
import { projectResponseModel, projectResponseModel2, projectResponseModelArray } from "../../../entities/project";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { publicPrivileges } from "../../../entities/privilege";
import { instrument_model_response } from "../../../entities/instrumentModel";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { LandMask } from "../../../../src/domain/interfaces/geography/land-mask";
import { exploreProject, projectStatsSample } from "../explore/explore-fixtures";

const LAND: LandMask = { isOnLand: () => false };

let mockUserRepository: UserRepository;
let mockSearchRepository: SearchRepository;
let mockProjectRepository: ProjectRepository;
let mockInstrumentModelRepository: MockInstrumentModelRepository;
let mockPrivilegeRepository: MockPrivilegeRepository;
let mockSampleRepository: MockSampleRepository;
let searchProjectUseCase: SearchProject;


beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockSearchRepository = new MockSearchRepository()
    mockProjectRepository = new MockProjectRepository()
    mockInstrumentModelRepository = new MockInstrumentModelRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockSampleRepository = new MockSampleRepository()
    searchProjectUseCase = new SearchProject(mockUserRepository, mockProjectRepository, mockSearchRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockSampleRepository, LAND)
    // The user has a privilege on both fixture projects, so the full projects come back
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false)
    jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockResolvedValue([1, 2])
})

test("deleted or invalid user should not be able to search for projects", async () => {
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
    jest.spyOn(mockProjectRepository, "standardGetProjects")


    await expect(searchProjectUseCase.execute(current_user, options, filters)).rejects.toThrow(outputError)

    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
    expect(mockSearchRepository.formatFilters).not.toBeCalled()
    expect(mockSearchRepository.formatSortBy).not.toBeCalled()
    expect(mockProjectRepository.standardGetProjects).not.toBeCalled()
});

test("Should return data for user without filter and sort_by", async () => {

    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: search_info
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const options: SearchOptions = {
        limit: 10,
        page: 1,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = []

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters")
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })


    const result = await searchProjectUseCase.execute(current_user, options, filters);


    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).not.toBeCalled()
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [], limit: 10, page: 1, sort_by: [] })

    expect(result).toStrictEqual(expectedResponse)
});

test("Should return data for user with filter and sort", async () => {

    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: [{ sort_by: "field1", order_by: "asc" }]
    }
    const filters: FilterSearchOptions[] = [{ field: "pasword_hash", operator: "SELECT", value: "%" }]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return [{ field: "pasword_hash", operator: "SELECT", value: "%" }] })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [{ sort_by: "field1", order_by: "asc" }] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })

    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith([{ field: "pasword_hash", operator: "SELECT", value: "%" }])
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([{ sort_by: "field1", order_by: "asc" }])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [{ field: "pasword_hash", operator: "SELECT", value: "%" }], limit: 10, page: 1, sort_by: [{ sort_by: "field1", order_by: "asc" }], })

    expect(result).toStrictEqual(expectedResponse)

});
test("No data to return", async () => {
    const ExpectedResult = {
        items: [],
        total: 0
    }
    const search_info = { limit: 10, page: 1, pages: 1, total: 0, total_on_page: 0 }
    const expectedResponse = {
        projects: [],

        search_info: search_info
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const options: SearchOptions = {
        limit: 10,
        page: 1,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = []

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters")
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })

    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).not.toBeCalled()
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [], limit: 10, page: 1, sort_by: [] })

    expect(result).toStrictEqual(expectedResponse)
});
test("Should return data for user with filter on instrument model", async () => {

    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = [{ field: "instrument_model", operator: "=", value: "UVP5HD" }]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const filters_IN = { field: "instrument_model", operator: "IN", value: [1] }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockInstrumentModelRepository, "standardGetInstrumentModels").mockImplementation(() => Promise.resolve({ items: [instrument_model_response], total: 1 }))

    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith([filters_IN])
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [filters_IN], limit: 10, page: 1, sort_by: [], })

    expect(result).toStrictEqual(expectedResponse)
});
test("Should return Instrument model not found with filter on unexisting instrument model", async () => {

    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = [{ field: "instrument_model", operator: "=", value: "UVP0" }]
    const search_info = { total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve({ items: [], total: 0 }))
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockInstrumentModelRepository, "standardGetInstrumentModels").mockImplementation(() => Promise.resolve({ items: [], total: 0 }))

    await expect(searchProjectUseCase.execute(current_user, options, filters)).rejects.toThrow(new Error("Instrument model not found"))

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).not.toBeCalled()
});

test("Should return data for user with filter on managing = true", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filter = { field: "for_managing", operator: "=", value: true }
    const filters: FilterSearchOptions[] = [filter]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]
    const filters_IN = [{ field: "project_id", operator: "IN", value: projectIds }]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockImplementation(() => Promise.resolve(projectIds))
    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: filters_IN, limit: 10, page: 1, sort_by: [], })

    expect(result).toStrictEqual(expectedResponse)
});
test("Should return data for user with filter on managing = false", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filter = { field: "for_managing", operator: "=", value: false }
    const filters: FilterSearchOptions[] = [filter]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockImplementation(() => Promise.resolve([1, 2]))
    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [], limit: 10, page: 1, sort_by: [], })

    expect(result).toStrictEqual(expectedResponse)
});
test("Should return data for user with filter on contact", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filter = { field: "contact", operator: "=", value: 1 }
    const filters: FilterSearchOptions[] = [filter]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]
    const filters_IN = [{ field: "project_id", operator: "IN", value: projectIds }]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByContacts").mockImplementation(() => Promise.resolve(projectIds))
    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({
        filter: filters_IN, limit: 10, page: 1, sort_by: [],
    })
    expect(result).toStrictEqual(expectedResponse)

});
test("Should return data for user with filter on user-based filters such as granted_users", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = [{ field: "granted_users", operator: "IN", value: [1, 2] }]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]
    const filters_IN = [{ field: "project_id", operator: "IN", value: projectIds }]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByUsers").mockImplementation(() => Promise.resolve(projectIds))
    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({
        filter: filters_IN, limit: 10, page: 1, sort_by: [],
    })

    expect(result).toStrictEqual(expectedResponse)
});
test("Should return data for user with filter on user-based filters such as managers, members", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }
    const expectedResponse = {
        projects: projectResponseModelArray,
        search_info: { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    }
    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = [{ field: "managers", operator: "=", value: 1 }, { field: "members", operator: "=", value: 2 }]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]
    const projectIds2 = [2, 4]
    const filters_IN = [{ field: "project_id", operator: "IN", value: projectIds }, { field: "project_id", operator: "IN", value: projectIds2 }]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByManagers").mockImplementation(() => Promise.resolve(projectIds))
    jest.spyOn(mockPrivilegeRepository, "getProjectsByMembers").mockImplementation(() => Promise.resolve(projectIds2))
    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({
        filter: filters_IN, limit: 10, page: 1, sort_by: [],
    })

    expect(result).toStrictEqual(expectedResponse)
});
test("Should return error if filter is not valid : operator IN and not an array of numbers", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }

    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filter = { field: "contact", operator: "IN", value: ["julie", "lena"] }
    const filters: FilterSearchOptions[] = [filter]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByContacts").mockImplementation(() => Promise.resolve(projectIds))

    await expect(searchProjectUseCase.execute(current_user, options, filters)).rejects.toThrow(new Error("contact should be an array of numbers"))

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).not.toBeCalled()
});
test("Should return error if filter is not valid : operator = and not a number", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }

    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filter = { field: "contact", operator: "=", value: "contact" }
    const filters: FilterSearchOptions[] = [filter]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByContacts").mockImplementation(() => Promise.resolve(projectIds))

    await expect(searchProjectUseCase.execute(current_user, options, filters)).rejects.toThrow(new Error("contact should be a number"))

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).not.toBeCalled()
});
test("Should return error if filter is not valid : operator different of = or IN", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }

    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filter = { field: "contact", operator: "LIKE", value: "%contact" }
    const filters: FilterSearchOptions[] = [filter]
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByContacts").mockImplementation(() => Promise.resolve(projectIds))

    await expect(searchProjectUseCase.execute(current_user, options, filters)).rejects.toThrow(new Error("contact should be an array of numbers or a number"))

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).toBeCalledWith(filters)
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).not.toBeCalled()
});
// Cannot find privileges : mapToPublicProjects
test("Should return error if cannot find privileges", async () => {
    const ExpectedResult = {
        items: projectResponseModelArray,
        total: 2
    }

    const current_user: UserUpdateModel = {
        user_id: 1,
    }

    const options = {
        page: 1,
        limit: 10,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = []
    const search_info = { total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 }
    const projectIds = [1, 2]

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(null))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return filters })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => projectResponseModel).mockImplementationOnce(() => projectResponseModel2)
    jest.spyOn(mockSearchRepository, "formatSearchInfo").mockImplementation(() => { return search_info })
    jest.spyOn(mockPrivilegeRepository, "getProjectsByContacts").mockImplementation(() => Promise.resolve(projectIds))

    await expect(searchProjectUseCase.execute(current_user, options, filters)).rejects.toThrow(new Error("Cannot find privileges"))

    // expect functions ahve been called with
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).not.toBeCalled()
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledTimes(1)
});

describe("what the list shows depends on the user's role on each project", () => {
    const options: SearchOptions = { limit: 10, page: 1, sort_by: [] }
    const full_1 = { ...projectResponseModel, root_folder_path: "folder_1", last_backup_utc_date_time: "2026-01-01" }
    const full_2 = { ...projectResponseModel2, root_folder_path: "folder_2", last_backup_utc_date_time: null }

    beforeEach(() => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue([])
        jest.spyOn(mockSearchRepository, "formatSortBy").mockReturnValue([])
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockResolvedValue(publicPrivileges)
        jest.spyOn(mockProjectRepository, "standardGetProjects").mockResolvedValue({ items: projectResponseModelArray, total: 2 })
        jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementation((project) => project.project_id === 1 ? full_1 : full_2)
        jest.spyOn(mockSearchRepository, "formatSearchInfo").mockReturnValue({ total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 })
    })

    test("a user outside a project still lists it, without its import folder or backup date", async () => {
        jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockResolvedValue([2])

        const result = await searchProjectUseCase.execute({ user_id: 1 }, options, [])

        expect(result.projects[0]).not.toHaveProperty("root_folder_path")
        expect(result.projects[0]).not.toHaveProperty("last_backup_utc_date_time")
        expect(result.projects[0].managers).toStrictEqual(full_1.managers)
        expect(result.projects[0].privacy_status).toBe("open")
        expect(result.projects[1]).toStrictEqual(full_2)
        expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledWith({ user_id: 1 })
    })

    test("an admin lists every project in full without any privilege lookup", async () => {
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")

        const result = await searchProjectUseCase.execute({ user_id: 1 }, options, [])

        expect(result.projects).toStrictEqual([full_1, full_2])
        expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
    })

    test("an empty page asks for no privilege at all", async () => {
        jest.spyOn(mockProjectRepository, "standardGetProjects").mockResolvedValue({ items: [], total: 0 })
        jest.spyOn(mockPrivilegeRepository, "getProjectsByUser")

        const result = await searchProjectUseCase.execute({ user_id: 1 }, options, [])

        expect(result.projects).toStrictEqual([])
        expect(mockPrivilegeRepository.getProjectsByUser).toBeCalledTimes(0)
    })

    test.each([
        ["filter", [{ field: "root_folder_path", operator: "LIKE", value: "uvp5%" }], []],
        ["sort", [], [{ sort_by: "root_folder_path", order_by: "asc" }]],
    ])("a user cannot probe the hidden import folder through a %s", async (_label, filter, sort_by) => {
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filter)
        jest.spyOn(mockSearchRepository, "formatSortBy").mockReturnValue(sort_by)
        jest.spyOn(mockProjectRepository, "standardGetProjects")

        await expect(searchProjectUseCase.execute({ user_id: 1 }, { ...options, sort_by: "asc(root_folder_path)" }, filter)).rejects.toThrow("Unauthorized or unexisting parameters : root_folder_path")
        expect(mockProjectRepository.standardGetProjects).toBeCalledTimes(0)
    })

    test("an admin may filter on the import folder", async () => {
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        const filter = [{ field: "root_folder_path", operator: "=", value: "uvp5_a" }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filter)

        const result = await searchProjectUseCase.execute({ user_id: 1 }, options, filter)

        expect(result.projects).toStrictEqual([full_1, full_2])
        expect(mockProjectRepository.standardGetProjects).toBeCalledWith(expect.objectContaining({ filter }))
    })
})

describe("qc_state is resolved to the projects in that state, as the QC state column shows it", () => {
    const options: SearchOptions = { limit: 10, page: 1, sort_by: [] }
    // 1: linked, its sample imported in EcoTaxa and fully validated; 2: not linked; 3: no sample.
    const projects = [
        exploreProject(1, "open", { ecotaxa_project_id: 1234, ecotaxa_instance_id: 1, last_backup_utc_date_time: "2024-07-10T00:00:00.000Z" }),
        exploreProject(2, "open"),
        exploreProject(3, "open"),
    ]
    const samples = new Map([
        [1, [projectStatsSample({ sample_id: 1, project_id: 1, ctd_imported: true, ecotaxa_sample_imported: true, sample_creation_utc_date_time: "2024-07-01T09:00:00.000Z" })]],
        [2, [projectStatsSample({ sample_id: 2, project_id: 2, ctd_imported: true })]],
        [3, []],
    ])
    const stored = { sample_id: 1, ecotaxa_sample_id: 9001, nb_unclassified: 0, nb_validated: 30, nb_dubious: 0, nb_predicted: 0, used_taxa: [45072], fetched_utc_date_time: "2026-10-23T00:00:00.000Z" }

    beforeEach(() => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockSearchRepository, "formatSortBy").mockReturnValue([])
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockResolvedValue(publicPrivileges)
        jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue(projects)
        jest.spyOn(mockSampleRepository, "getProjectStatsSamples").mockImplementation(async (...args: unknown[]) => samples.get(args[0] as number) ?? [])
        jest.spyOn(mockSampleRepository, "getEcoTaxaStats").mockImplementation(async (...args: unknown[]) => (args[0] as number[]).includes(1) ? [stored] : [])
        jest.spyOn(mockProjectRepository, "standardGetProjects").mockResolvedValue({ items: [], total: 0 })
        jest.spyOn(mockSearchRepository, "formatSearchInfo").mockReturnValue({ total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 })
    })

    test.each([
        ["=", "ok", [1]],
        ["=", "warning", [2]],
        ["=", "empty", [3]],
        ["IN", ["ok", "empty"], [1, 3]],
    ])("operator %s with %j", async (operator, value, expected_ids) => {
        const filters = [{ field: "qc_state", operator, value }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filters)

        await searchProjectUseCase.execute({ user_id: 1 }, options, filters)

        expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [{ field: "project_id", operator: "IN", value: expected_ids }], limit: 10, page: 1, sort_by: [] })
        expect(mockSampleRepository.getProjectStatsSamples).toBeCalledTimes(3)
    })

    test("the raw backup warning counts for a user with a privilege on the project, as on its STATS tab", async () => {
        jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockResolvedValue([1])
        jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([{ ...projects[0], last_backup_utc_date_time: null }])
        const filters = [{ field: "qc_state", operator: "=", value: "warning" }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filters)

        await searchProjectUseCase.execute({ user_id: 1 }, options, filters)

        expect(mockProjectRepository.standardGetProjects).toBeCalledWith(expect.objectContaining({ filter: [{ field: "project_id", operator: "IN", value: [1] }] }))
    })

    test.each([
        ["=", "validated"],
        ["IN", []],
        ["IN", ["ok", "nope"]],
        ["LIKE", "ok%"],
    ])("refuses operator %s with %j", async (operator, value) => {
        const filters = [{ field: "qc_state", operator, value }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filters)

        await expect(searchProjectUseCase.execute({ user_id: 1 }, options, filters)).rejects.toThrow("Unauthorized or unexisting parameters : qc_state")
        expect(mockProjectRepository.standardGetProjects).toBeCalledTimes(0)
    })
})

describe("privacy_status is resolved to the projects at that level", () => {
    const options: SearchOptions = { limit: 10, page: 1, sort_by: [] }
    // Far from any boundary, so the levels do not depend on the day the tests run
    const projects_privacy = [
        { project_id: 1, oldest_sample_utc_date_time: "2026-01-01T00:00:00Z", privacy_duration: 1200, visible_duration: 0, public_duration: 0 },
        { project_id: 2, oldest_sample_utc_date_time: "1990-01-01T00:00:00Z", privacy_duration: 0, visible_duration: 1200, public_duration: 0 },
        { project_id: 3, oldest_sample_utc_date_time: "1990-01-01T00:00:00Z", privacy_duration: 0, visible_duration: 0, public_duration: 1200 },
        { project_id: 4, oldest_sample_utc_date_time: "1990-01-01T00:00:00Z", privacy_duration: 1, visible_duration: 1, public_duration: 1 },
    ]

    beforeEach(() => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockSearchRepository, "formatSortBy").mockReturnValue([])
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockResolvedValue(publicPrivileges)
        jest.spyOn(mockProjectRepository, "listProjectsPrivacy").mockResolvedValue(projects_privacy)
        jest.spyOn(mockProjectRepository, "standardGetProjects").mockResolvedValue({ items: [], total: 0 })
        jest.spyOn(mockSearchRepository, "formatSearchInfo").mockReturnValue({ total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 })
    })

    test.each([
        ["=", "private", [1]],
        ["=", "visible", [2]],
        ["=", "public", [3]],
        ["=", "open", [4]],
        ["IN", ["public", "open"], [3, 4]],
    ])("operator %s with %j", async (operator, value, expected_ids) => {
        const filters = [{ field: "privacy_status", operator, value }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filters)

        await searchProjectUseCase.execute({ user_id: 1 }, options, filters)

        expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [{ field: "project_id", operator: "IN", value: expected_ids }], limit: 10, page: 1, sort_by: [] })
    })

    test("no project at that level gives an empty IN, not an unfiltered list", async () => {
        jest.spyOn(mockProjectRepository, "listProjectsPrivacy").mockResolvedValue([projects_privacy[3]])
        const filters = [{ field: "privacy_status", operator: "=", value: "private" }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filters)

        await searchProjectUseCase.execute({ user_id: 1 }, options, filters)

        expect(mockProjectRepository.standardGetProjects).toBeCalledWith(expect.objectContaining({ filter: [{ field: "project_id", operator: "IN", value: [] }] }))
    })

    test("combines with for_managing as two project_id filters", async () => {
        jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockResolvedValue([1, 3])
        const filters = [{ field: "for_managing", operator: "=", value: true }, { field: "privacy_status", operator: "=", value: "public" }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filters)

        await searchProjectUseCase.execute({ user_id: 1 }, options, filters)

        expect(mockProjectRepository.standardGetProjects).toBeCalledWith(expect.objectContaining({
            filter: [{ field: "project_id", operator: "IN", value: [1, 3] }, { field: "project_id", operator: "IN", value: [3] }]
        }))
    })

    test.each([
        ["=", "Open"],
        ["=", "public+"],
        ["IN", []],
        ["IN", ["public", "nope"]],
        ["LIKE", "pub%"],
        ["<>", "private"],
    ])("refuses operator %s with %j", async (operator, value) => {
        const filters = [{ field: "privacy_status", operator, value }]
        jest.spyOn(mockSearchRepository, "formatFilters").mockReturnValue(filters)

        await expect(searchProjectUseCase.execute({ user_id: 1 }, options, filters)).rejects.toThrow("privacy_status should be one of private, visible, public, open, or an array of them with IN")
        expect(mockProjectRepository.listProjectsPrivacy).toBeCalledTimes(0)
        expect(mockProjectRepository.standardGetProjects).toBeCalledTimes(0)
    })
})
