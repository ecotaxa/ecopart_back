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

let mockUserRepository: UserRepository;
let mockSearchRepository: SearchRepository;
let mockProjectRepository: ProjectRepository;
let mockInstrumentModelRepository: MockInstrumentModelRepository;
let mockPrivilegeRepository: MockPrivilegeRepository;
let searchProjectUseCase: SearchProject;


beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockSearchRepository = new MockSearchRepository()
    mockProjectRepository = new MockProjectRepository()
    mockInstrumentModelRepository = new MockInstrumentModelRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    searchProjectUseCase = new SearchProject(mockUserRepository, mockProjectRepository, mockSearchRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
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
    jest.spyOn(mockPrivilegeRepository, "getProjectsByUser").mockImplementation(() => Promise.resolve([]))
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
