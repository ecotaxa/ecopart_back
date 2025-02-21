import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { LoginEcotaxaAccount } from '../../../../src/domain/use-cases/ecotaxa_account/login-ecotaxa_account';
import { ecotaxa_account_1, ecotaxa_instance_1, ecotaxaAccountRequestCreationModel, ecotaxaAccountResponseModel_1, public_ecotaxa_request_creation_model, publicEcotaxaAccountResponseModel_1 } from "../../../entities/user";
import { MockUserRepository } from "../../../mocks/user-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicEcotaxaAccountRequestCreationModel } from "../../../../src/domain/entities/ecotaxa_account";

let mockEcotaxaAccountRepository: EcotaxaAccountRepository;
let mockUserRepository: MockUserRepository;
let loginEcotaxaAccountsUseCase: LoginEcotaxaAccount;

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository()
    loginEcotaxaAccountsUseCase = new LoginEcotaxaAccount(mockUserRepository, mockEcotaxaAccountRepository)
})

describe("Domain - Use Cases - Login ecotaxa account", () => {
    describe("User can get logged out from ecotaxa account", () => {
        test("Login ecotaxa account a user can create account for himself", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance').mockResolvedValueOnce(ecotaxa_instance_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'accountExists').mockResolvedValueOnce(false);
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);
            jest.spyOn(mockEcotaxaAccountRepository, 'connectToEcotaxaInstance').mockResolvedValueOnce(ecotaxa_account_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'createEcotaxaAccount').mockResolvedValueOnce(3);
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(ecotaxaAccountResponseModel_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse').mockReturnValueOnce(publicEcotaxaAccountResponseModel_1);


            await loginEcotaxaAccountsUseCase.execute(current_user, ecotaxa_account_to_create);


            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecotaxa_account_to_create.ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create.ecotaxa_instance_id);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.isAdmin).toHaveBeenNthCalledWith(1, current_user.user_id);

            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenNthCalledWith(1, ecotaxaAccountRequestCreationModel);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, 3);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenNthCalledWith(1, ecotaxaAccountResponseModel_1);
        });
        test("Login ecotaxa account a admin can create account for any user", async () => {
            const current_user: UserUpdateModel = {
                user_id: 2
            };
            const ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance').mockResolvedValueOnce(ecotaxa_instance_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'accountExists').mockResolvedValueOnce(false);
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(true);
            jest.spyOn(mockEcotaxaAccountRepository, 'connectToEcotaxaInstance').mockResolvedValueOnce(ecotaxa_account_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'createEcotaxaAccount').mockResolvedValueOnce(3);
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(ecotaxaAccountResponseModel_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse').mockReturnValueOnce(publicEcotaxaAccountResponseModel_1);


            await loginEcotaxaAccountsUseCase.execute(current_user, ecotaxa_account_to_create);


            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecotaxa_account_to_create.ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create.ecotaxa_instance_id);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.isAdmin).toHaveBeenNthCalledWith(1, current_user.user_id);

            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenNthCalledWith(1, ecotaxaAccountRequestCreationModel);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, 3);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenNthCalledWith(1, ecotaxaAccountResponseModel_1);
        });


    });

    describe("User cannot get ecotaxa account", () => {
        test("Login ecotaxa account but Ecotaxa account not found", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model
            const expectedError = new Error("Ecotaxa account not found");

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance').mockResolvedValueOnce(ecotaxa_instance_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'accountExists').mockResolvedValueOnce(false);
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);
            jest.spyOn(mockEcotaxaAccountRepository, 'connectToEcotaxaInstance').mockResolvedValueOnce(ecotaxa_account_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'createEcotaxaAccount').mockResolvedValueOnce(3);
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount').mockResolvedValueOnce(null);
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse')


            try { await loginEcotaxaAccountsUseCase.execute(current_user, ecotaxa_account_to_create); }
            catch (error) {
                expect(error).toEqual(expectedError);
            }


            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecotaxa_account_to_create.ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create.ecotaxa_instance_id);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.isAdmin).toHaveBeenNthCalledWith(1, current_user.user_id);

            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenNthCalledWith(1, ecotaxaAccountRequestCreationModel);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenNthCalledWith(1, 3);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledTimes(0);
        });
        test("Login ecotaxa account but User cannot add account to the desired ecopart user", async () => {
            const current_user: UserUpdateModel = {
                user_id: 2
            };
            const ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model
            const expectedError = new Error("User cannot add account to the desired ecopart user");

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance').mockResolvedValueOnce(ecotaxa_instance_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'accountExists').mockResolvedValueOnce(false);
            jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(false);
            jest.spyOn(mockEcotaxaAccountRepository, 'connectToEcotaxaInstance')
            jest.spyOn(mockEcotaxaAccountRepository, 'createEcotaxaAccount')
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount')
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse')


            try { await loginEcotaxaAccountsUseCase.execute(current_user, ecotaxa_account_to_create); }
            catch (error) {
                expect(error).toEqual(expectedError);
            }


            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecotaxa_account_to_create.ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create.ecotaxa_instance_id);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.isAdmin).toHaveBeenNthCalledWith(1, current_user.user_id);

            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledTimes(0);
        });
        test("Login ecotaxa account but Account already exists", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model
            const expectedError = new Error("Account already exists");

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance').mockResolvedValueOnce(ecotaxa_instance_1);
            jest.spyOn(mockEcotaxaAccountRepository, 'accountExists').mockResolvedValueOnce(true);
            jest.spyOn(mockUserRepository, 'isAdmin')
            jest.spyOn(mockEcotaxaAccountRepository, 'connectToEcotaxaInstance')
            jest.spyOn(mockEcotaxaAccountRepository, 'createEcotaxaAccount')
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount')
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse')


            try { await loginEcotaxaAccountsUseCase.execute(current_user, ecotaxa_account_to_create); }
            catch (error) {
                expect(error).toEqual(expectedError);
            }


            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecotaxa_account_to_create.ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create.ecotaxa_instance_id);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0);

            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledTimes(0);
        });
        test("Login ecotaxa account but Ecotaxa instance not found : ", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1
            };
            const ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model
            const expectedError = new Error("Ecotaxa instance not found : " + ecotaxa_account_to_create.ecotaxa_instance_id);

            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce();
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance').mockResolvedValueOnce(null);
            jest.spyOn(mockEcotaxaAccountRepository, 'accountExists')
            jest.spyOn(mockUserRepository, 'isAdmin')
            jest.spyOn(mockEcotaxaAccountRepository, 'connectToEcotaxaInstance')
            jest.spyOn(mockEcotaxaAccountRepository, 'createEcotaxaAccount')
            jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcotaxaAccount')
            jest.spyOn(mockEcotaxaAccountRepository, 'formatEcotaxaAccountResponse')


            try { await loginEcotaxaAccountsUseCase.execute(current_user, ecotaxa_account_to_create); }
            catch (error) {
                expect(error).toEqual(expectedError);
            }


            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(2);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(1, current_user.user_id);
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenNthCalledWith(2, ecotaxa_account_to_create.ecopart_user_id);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenCalledTimes(1);
            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenNthCalledWith(1, ecotaxa_account_to_create.ecotaxa_instance_id);
            expect(mockEcotaxaAccountRepository.accountExists).toHaveBeenCalledTimes(0);
            expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0);

            expect(mockEcotaxaAccountRepository.connectToEcotaxaInstance).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.createEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledTimes(0);
            expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledTimes(0);
        });
    });
});