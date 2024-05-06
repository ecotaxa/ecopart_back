import { DecodedToken } from "../../../../src/domain/entities/auth";
import { FilterSearchOptions, SearchOptions, SearchResult } from "../../../../src/domain/entities/search";
import { UserResponseModel, UserUpdateModel, } from "../../../../src/domain/entities/user";
import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SearchUsers } from '../../../../src/domain/use-cases/user/search-users'

describe("Get All Users Use Case", () => {

    class MockUserRepository implements UserRepository {
        adminGetUsers(): Promise<SearchResult<UserResponseModel>> {
            throw new Error("Method not implemented.");
        }
        standardGetUsers(): Promise<SearchResult<UserResponseModel>> {
            throw new Error("Method not implemented.");
        }
        deleteUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        isDeleted(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        generateResetPasswordToken(): string {
            throw new Error("Method not implemented.");
        }
        verifyResetPasswordToken(): DecodedToken | null {
            throw new Error("Method not implemented.");
        }
        setResetPasswordCode(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        toPublicUser(): UserResponseModel {
            throw new Error("Method not implemented.");
        }
        changePassword(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        adminUpdateUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        standardUpdateUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        isAdmin(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        createUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        getUsers(): Promise<UserResponseModel[]> {
            throw new Error("Method not implemented.");
        }
        getUser(): Promise<UserResponseModel | null> {
            throw new Error("Method not implemented.");
        }
        verifyUserLogin(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        validUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        generateValidationToken(): string {
            throw new Error("Method not implemented.");
        }
        verifyValidationToken(): DecodedToken | null {
            throw new Error("Method not implemented.");
        }
    }
    class MockSearchRepository implements SearchRepository {
        formatFilters(): any {
            throw new Error("Method not implemented.");
        }
        formatSortBy(): any {
            throw new Error("Method not implemented.");
        }
    }

    let mockUserRepository: UserRepository;
    let mockSearchRepository: SearchRepository;
    let searchUsersUse: SearchUsers;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
        mockSearchRepository = new MockSearchRepository()
        searchUsersUse = new SearchUsers(mockUserRepository, mockSearchRepository)
    })

    test("deleted user should not be able to search for users", async () => {
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
        jest.spyOn(mockUserRepository, "standardGetUsers")
        jest.spyOn(mockUserRepository, "toPublicUser")


        await expect(searchUsersUse.execute(current_user, options, filters)).rejects.toThrow("User is deleted")

        expect(mockUserRepository.isDeleted).toBeCalledTimes(1)
        expect(mockSearchRepository.formatFilters).not.toBeCalled()
        expect(mockSearchRepository.formatSortBy).not.toBeCalled()
        expect(mockUserRepository.standardGetUsers).not.toBeCalled()
        expect(mockUserRepository.toPublicUser).not.toBeCalled()
    });
    test("Should return data for standard user without filter and sort_by", async () => {
        const public_user = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const private_user = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
            deleted: undefined,
            confirmation_code: undefined,
            reset_password_code: undefined
        }

        const ExpectedResult = {
            users: [private_user, private_user],
            total: 2
        }
        const expectedResponse = {
            users: [public_user, public_user],

            search_info: { limit: 10, page: 1, pages: 1, total: 2, total_on_page: 2 }
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
        jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return [] })
        jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "standardGetUsers").mockImplementation(() => Promise.resolve(ExpectedResult))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => { return public_user })
        const result = await searchUsersUse.execute(current_user, options, filters);
        expect(result).toStrictEqual(expectedResponse)

    });

    test("Should return data for admin user without filter and sort", async () => {
        const public_user = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
            deleted: undefined,
            confirmation_code: undefined,
            reset_password_code: undefined
        }
        const private_user = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
            deleted: undefined,
            confirmation_code: undefined,
            reset_password_code: undefined
        }

        const ExpectedResult = {
            users: [private_user, private_user],
            total: 2
        }
        const expectedResponse = {
            users: [public_user, public_user],

            search_info: { limit: 10, page: 1, pages: 1, total: 2, total_on_page: 2 }
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
        jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return [] })
        jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "adminGetUsers").mockImplementation(() => Promise.resolve(ExpectedResult))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => { return public_user })
        const result = await searchUsersUse.execute(current_user, options, filters);
        expect(result).toStrictEqual(expectedResponse)
    });
    test("Should return data for admin user with filter and sort", async () => {
        const public_user = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const private_user = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
            deleted: undefined,
            confirmation_code: undefined,
            reset_password_code: undefined
        }

        const ExpectedResult = {
            users: [private_user, private_user],
            total: 2
        }
        const expectedResponse = {
            users: [public_user, public_user],

            search_info: { limit: 10, page: 1, pages: 1, total: 2, total_on_page: 2 }
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
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "standardGetUsers").mockImplementation(() => Promise.resolve(ExpectedResult))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => { return public_user })
        const result = await searchUsersUse.execute(current_user, options, filters);
        expect(result).toStrictEqual(expectedResponse)

    });
    test("No data to return", async () => {
        const ExpectedResult = {
            users: [],
            total: 0
        }
        const expectedResponse = {
            users: [],

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
        jest.spyOn(mockSearchRepository, "formatFilters").mockImplementation(() => { return [] })
        jest.spyOn(mockSearchRepository, "formatSortBy").mockImplementation(() => { return [] })
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "standardGetUsers").mockImplementation(() => Promise.resolve(ExpectedResult))
        const result = await searchUsersUse.execute(current_user, options, filters);
        expect(result).toStrictEqual(expectedResponse)

    });
});