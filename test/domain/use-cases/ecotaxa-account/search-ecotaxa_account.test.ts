import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { MockSearchRepository } from "../../../mocks/search-mock";
import { SearchEcotaxaAccounts } from '../../../../src/domain/use-cases/ecotaxa_account/search-ecotaxa_account';
import { ecotaxaAccountResponseModel, public_ecotaxa_account_response_model_2 } from "../../../entities/user";
import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { EcotaxaAccountResponseModel } from "../../../../src/domain/entities/ecotaxa_account";
import { PreparedSearchOptions, SearchOptions, SearchResult } from "../../../../src/domain/entities/search";


let mockEcotaxaAccountRepository: EcotaxaAccountRepository;
let mockSearchRepository: SearchRepository;
let mockUserRepository: MockUserRepository;
let searchEcotaxaAccountsUseCase: SearchEcotaxaAccounts;

beforeEach(() => {
    jest.clearAllMocks();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository()
    mockSearchRepository = new MockSearchRepository()
    mockUserRepository = new MockUserRepository()
    searchEcotaxaAccountsUseCase = new SearchEcotaxaAccounts(mockUserRepository, mockEcotaxaAccountRepository, mockSearchRepository)
})

describe("Domain - Use Cases - Search ecotaxa account", () => {
    describe("User can get ecotaxa account", () => {
        test("Search ecotaxa account with filters, should be forced to user id ", async () => {
            const options = { filter: [{ field: "ecotaxa_account_name", operator: "=", value: "UVP5" }], sort_by: [], page: 1, limit: 10 }
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecotaxa_accounts_response: SearchResult<EcotaxaAccountResponseModel> = { items: [ecotaxaAccountResponseModel], total: 1 }
            const search_info_response = { total: 1, page: 1, pages: 1, limit: 10, total_on_page: 1 }

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockSearchRepository, 'formatSortBy').mockImplementation(() => [{ sort_by: "ecotaxa_account_name", order_by: "asc" }])
            // default jest.spyOn(mockSearchRepository, 'formatSortBy').mockImplementation(() => [{ sort_by: "ecotaxa_account_expiration_date", order_by: "asc" }])
            jest.spyOn(mockEcotaxaAccountRepository, 'standardGetEcotaxaAccountsModels').mockResolvedValueOnce(ecotaxa_accounts_response);
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse').mockReturnValueOnce(public_ecotaxa_account_response_model_2);
            jest.spyOn(mockSearchRepository, 'formatSearchInfo').mockReturnValueOnce(search_info_response);
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);

            const { ecotaxa_accounts, search_info } = await searchEcotaxaAccountsUseCase.execute(current_user, 1, options);

            expect(ecotaxa_accounts.length).toBe(1);
            expect(search_info.total).toBe(1);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, 1);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, 1);
            expect(mockSearchRepository.formatSortBy).toHaveBeenCalledTimes(1);
            expect(mockSearchRepository.formatSortBy).toHaveBeenNthCalledWith(1, "asc(ecotaxa_account_expiration_date)");
            expect(mockEcotaxaAccountRepository.standardGetEcotaxaAccountsModels).toHaveBeenCalledWith(options as PreparedSearchOptions);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledWith(ecotaxaAccountResponseModel);
            expect(mockSearchRepository.formatSearchInfo).toHaveBeenCalledWith(ecotaxa_accounts_response, options);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledWith(1);
        });
        test("Search ecotaxa account with sort by", async () => {
            const options: SearchOptions = { sort_by: "asc(ecotaxa_account_id)", page: 1, limit: 10 }
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecotaxa_accounts_response: SearchResult<EcotaxaAccountResponseModel> = { items: [ecotaxaAccountResponseModel], total: 1 }
            const search_info_response = { total: 1, page: 1, pages: 1, limit: 10, total_on_page: 1 }

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            //jest.spyOn(mockSearchRepository, 'formatSortBy').mockImplementation(() => [{ sort_by: "ecotaxa_account_name", order_by: "asc" }])
            jest.spyOn(mockSearchRepository, 'formatSortBy').mockImplementation(() => [{ sort_by: "ecotaxa_account_id", order_by: "asc" }])
            jest.spyOn(mockEcotaxaAccountRepository, 'standardGetEcotaxaAccountsModels').mockResolvedValueOnce(ecotaxa_accounts_response);
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse').mockReturnValueOnce(public_ecotaxa_account_response_model_2);
            jest.spyOn(mockSearchRepository, 'formatSearchInfo').mockReturnValueOnce(search_info_response);
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);

            const { ecotaxa_accounts, search_info } = await searchEcotaxaAccountsUseCase.execute(current_user, 1, options);

            expect(ecotaxa_accounts.length).toBe(1);
            expect(search_info.total).toBe(1);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, 1);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, 1);
            expect(mockSearchRepository.formatSortBy).toHaveBeenCalledTimes(1);
            expect(mockSearchRepository.formatSortBy).toHaveBeenNthCalledWith(1, "asc(ecotaxa_account_id)");
            expect(mockEcotaxaAccountRepository.standardGetEcotaxaAccountsModels).toHaveBeenCalledWith(options as PreparedSearchOptions);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledWith(ecotaxaAccountResponseModel);
            expect(mockSearchRepository.formatSearchInfo).toHaveBeenCalledWith(ecotaxa_accounts_response, options);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledWith(1);
        });
        test("user can get ecotaxa account because is admin and not the same user", async () => {
            const options = { filter: [{ field: "ecotaxa_account_name", operator: "=", value: "UVP5" }], sort_by: [], page: 1, limit: 10 }
            const current_user: UserUpdateModel = {
                user_id: 2
            };
            const ecotaxa_accounts_response: SearchResult<EcotaxaAccountResponseModel> = { items: [ecotaxaAccountResponseModel], total: 1 }
            const search_info_response = { total: 1, page: 1, pages: 1, limit: 10, total_on_page: 1 }

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(true);
            jest.spyOn(mockSearchRepository, 'formatSortBy').mockImplementation(() => [{ sort_by: "ecotaxa_account_name", order_by: "asc" }])
            // default jest.spyOn(mockSearchRepository, 'formatSortBy').mockImplementation(() => [{ sort_by: "ecotaxa_account_expiration_date", order_by: "asc" }])
            jest.spyOn(mockEcotaxaAccountRepository, 'standardGetEcotaxaAccountsModels').mockResolvedValueOnce(ecotaxa_accounts_response);
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse').mockReturnValueOnce(public_ecotaxa_account_response_model_2);
            jest.spyOn(mockSearchRepository, 'formatSearchInfo').mockReturnValueOnce(search_info_response);
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);

            const { ecotaxa_accounts, search_info } = await searchEcotaxaAccountsUseCase.execute(current_user, 1, options);

            expect(ecotaxa_accounts.length).toBe(1);
            expect(search_info.total).toBe(1);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, 2);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledWith(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, 1);
            expect(mockSearchRepository.formatSortBy).toHaveBeenCalledTimes(1);
            expect(mockSearchRepository.formatSortBy).toHaveBeenNthCalledWith(1, "asc(ecotaxa_account_expiration_date)");
            expect(mockEcotaxaAccountRepository.standardGetEcotaxaAccountsModels).toHaveBeenCalledWith(options as PreparedSearchOptions);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledWith(ecotaxaAccountResponseModel);
            expect(mockSearchRepository.formatSearchInfo).toHaveBeenCalledWith(ecotaxa_accounts_response, options);
        });
    });

    describe("User cannot get ecotaxa account", () => {
        test("user cannot get ecotaxa account because not admin and not the same user", async () => {
            const options = { filter: [{ field: "ecotaxa_account_name", operator: "=", value: "UVP5" }], sort_by: [], page: 1, limit: 10 }
            const current_user: UserUpdateModel = {
                user_id: 2
            };

            const expected_error = "User cannot get requested ecotaxa accounts"

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);
            jest.spyOn(mockSearchRepository, 'formatSortBy')
            // default jest.spyOn(mockSearchRepository, 'formatSortBy').mockImplementation(() => [{ sort_by: "ecotaxa_account_expiration_date", order_by: "asc" }])
            jest.spyOn(mockEcotaxaAccountRepository, 'standardGetEcotaxaAccountsModels')
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse')
            jest.spyOn(mockSearchRepository, 'formatSearchInfo')

            try {
                await searchEcotaxaAccountsUseCase.execute(current_user, 1, options);
            } catch (error) {
                expect(error.message).toBe(expected_error);
            }
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, 2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, 1);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledWith(2);
            expect(mockSearchRepository.formatSortBy).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.standardGetEcotaxaAccountsModels).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledTimes(0);
            expect(mockSearchRepository.formatSearchInfo).toHaveBeenCalledTimes(0);
        });
    });
});