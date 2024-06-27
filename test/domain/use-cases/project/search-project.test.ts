import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SearchProject } from '../../../../src/domain/use-cases/project/search-projects'

import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSearchRepository } from "../../../mocks/search-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { FilterSearchOptions, SearchOptions } from "../../../../src/domain/entities/search";
import { projectResponseModelArray } from "../../../entities/project";


let mockUserRepository: UserRepository;
let mockSearchRepository: SearchRepository;
let mockProjectRepository: ProjectRepository;
let searchProjectUseCase: SearchProject;

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockSearchRepository = new MockSearchRepository()
    mockProjectRepository = new MockProjectRepository()
    searchProjectUseCase = new SearchProject(mockUserRepository, mockProjectRepository, mockSearchRepository)
})

test("deleted user should not be able to search for projects", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const options: SearchOptions = {
        limit: 10,
        page: 1,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = []

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockSearchRepository, "formatFilters")
    jest.spyOn(mockSearchRepository, "formatSortBy")
    jest.spyOn(mockProjectRepository, "standardGetProjects")


    await expect(searchProjectUseCase.execute(current_user, options, filters)).rejects.toThrow("User is deleted")

    expect(mockUserRepository.isDeleted).toBeCalledTimes(1)
    expect(mockSearchRepository.formatFilters).not.toBeCalled()
    expect(mockSearchRepository.formatSortBy).not.toBeCalled()
    expect(mockProjectRepository.standardGetProjects).not.toBeCalled()
});

test("Should return data for user without filter and sort_by", async () => {


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
    const options: SearchOptions = {
        limit: 10,
        page: 1,
        sort_by: []
    }
    const filters: FilterSearchOptions[] = []

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockSearchRepository, "formatFilters")
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))



    const result = await searchProjectUseCase.execute(current_user, options, filters);


    // expect functions ahve been called with
    expect(mockUserRepository.isDeleted).toBeCalledWith(1)
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

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return [{ field: "pasword_hash", operator: "SELECT", value: "%" }] })
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [{ sort_by: "field1", order_by: "asc" }] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))



    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.isDeleted).toBeCalledWith(1)
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
    const expectedResponse = {
        projects: [],

        search_info: { limit: 10, page: 1, pages: 1, total: 0, total_on_page: 0 }
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

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockSearchRepository, "formatFilters")
    jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
    jest.spyOn(mockProjectRepository, "standardGetProjects").mockImplementation(() => Promise.resolve(ExpectedResult))

    const result = await searchProjectUseCase.execute(current_user, options, filters);

    // expect functions ahve been called with
    expect(mockUserRepository.isDeleted).toBeCalledWith(1)
    expect(mockSearchRepository.formatFilters).not.toBeCalled()
    expect(mockSearchRepository.formatSortBy).toBeCalledWith([])
    expect(mockProjectRepository.standardGetProjects).toBeCalledWith({ filter: [], limit: 10, page: 1, sort_by: [] })

    expect(result).toStrictEqual(expectedResponse)
});