import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { LogoutEcotaxaAccount } from '../../../../src/domain/use-cases/ecotaxa_account/logout-ecotaxa_account';
import { ecotaxaAccountResponseModel, ecotaxaAccountResponseModel_2 } from "../../../entities/user";
import { MockUserRepository } from "../../../mocks/user-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";

let mockEcotaxaAccountRepository: EcotaxaAccountRepository;
let mockUserRepository: MockUserRepository;
let logoutEcotaxaAccountsUseCase: LogoutEcotaxaAccount;

beforeEach(() => {
    jest.clearAllMocks();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository()
    mockUserRepository = new MockUserRepository()
    logoutEcotaxaAccountsUseCase = new LogoutEcotaxaAccount(mockUserRepository, mockEcotaxaAccountRepository)
})

describe("Domain - Use Cases - Logout ecotaxa account", () => {
    describe("User can get logged out from ecotaxa account", () => {
        test("Logout ecotaxa account not admin can logout from his account", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecopart_user_id: number = 1
            const ecotaxa_account_to_delete_id: number = 1

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(ecotaxaAccountResponseModel);
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);
            jest.spyOn(mockEcotaxaAccountRepository, 'deleteEcotaxaAccount').mockResolvedValueOnce(1);


            await logoutEcotaxaAccountsUseCase.execute(current_user, ecopart_user_id, ecotaxa_account_to_delete_id);


            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, 1, ecopart_user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, 1);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount).toHaveBeenNthCalledWith(1, {
                ecotaxa_account_id: ecopart_user_id,
                ecotaxa_account_ecopart_user_id: ecotaxa_account_to_delete_id
            });
        });
        test("Logout ecotaxa account, admin can loggout any user", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecopart_user_id: number = 2
            const ecotaxa_account_to_delete_id: number = 4

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(ecotaxaAccountResponseModel_2);
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(true);
            jest.spyOn(mockEcotaxaAccountRepository, 'deleteEcotaxaAccount').mockResolvedValueOnce(1);

            await logoutEcotaxaAccountsUseCase.execute(current_user, ecopart_user_id, ecotaxa_account_to_delete_id);

            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, ecotaxa_account_to_delete_id, ecopart_user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecopart_user_id);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount).toHaveBeenNthCalledWith(1, {
                ecotaxa_account_id: ecotaxa_account_to_delete_id,
                ecotaxa_account_ecopart_user_id: ecopart_user_id
            });
        });

    });

    describe("User cannot get ecotaxa account", () => {
        test("Logout ecotaxa account, but Ecotaxa account not found", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecopart_user_id: number = 2
            const ecotaxa_account_to_delete_id: number = 4

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(null);
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed')
            jest.spyOn(mockUserRepository, 'isAdmin')
            jest.spyOn(mockEcotaxaAccountRepository, 'deleteEcotaxaAccount')

            try { await logoutEcotaxaAccountsUseCase.execute(current_user, ecopart_user_id, ecotaxa_account_to_delete_id); }
            catch (error) {
                expect(error.message).toBe("Ecotaxa account not found");
            }

            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, ecotaxa_account_to_delete_id, ecopart_user_id);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount)
        });
        test("Logout ecotaxa account, but User cannot logout from the requested ecotaxa account", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecopart_user_id: number = 2
            const ecotaxa_account_to_delete_id: number = 4

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(ecotaxaAccountResponseModel_2);
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);
            jest.spyOn(mockEcotaxaAccountRepository, 'deleteEcotaxaAccount')

            try { await logoutEcotaxaAccountsUseCase.execute(current_user, ecopart_user_id, ecotaxa_account_to_delete_id); }
            catch (error) {
                expect(error.message).toBe("User cannot logout from the requested ecotaxa account");
            }

            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, ecotaxa_account_to_delete_id, ecopart_user_id);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount)
        });
        test("Logout ecotaxa account, but Cannot delete ecotaxa account", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecopart_user_id: number = 2
            const ecotaxa_account_to_delete_id: number = 4

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(ecotaxaAccountResponseModel_2);
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(true);
            jest.spyOn(mockEcotaxaAccountRepository, 'deleteEcotaxaAccount').mockResolvedValueOnce(0);

            try { await logoutEcotaxaAccountsUseCase.execute(current_user, ecopart_user_id, ecotaxa_account_to_delete_id); }
            catch (error) {
                expect(error.message).toBe("Cannot delete ecotaxa account");
            }

            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, ecotaxa_account_to_delete_id, ecopart_user_id);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.deleteEcotaxaAccount)
        });

    });
});