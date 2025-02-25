//test/domain/repositories/ecotaxa_account-repository.test.ts
import { EcotaxaAccountDataSource } from "../../../src/data/interfaces/data-sources/ecotaxa_account-data-source";
import { EcotaxaAccountRequestCreationModel, PublicEcotaxaAccountRequestCreationModel } from "../../../src/domain/entities/ecotaxa_account";
import { PreparedSearchOptions } from "../../../src/domain/entities/search";
import { EcotaxaAccountRepository } from "../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { EcotaxaAccountRepositoryImpl } from "../../../src/domain/repositories/ecotaxa_account-repository";
import { ecotaxa_instance_test_ecotaxa, ecotaxaAccountRequestCreationModel, ecotaxaAccountResponseModel_1, public_ecotaxa_request_creation_model, public_ecotaxa_request_creation_model_test_user, searchhResultEcotaxaAccountResponseModel } from "../../entities/user";
import { MockEcotaxaAccountDataSource } from "../../mocks/user-mock";


describe("EcotaxaAccount Repository", () => {
    let mockEcotaxaAccountDataSource: EcotaxaAccountDataSource;
    let ecotaxa_accountRepository: EcotaxaAccountRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEcotaxaAccountDataSource = new MockEcotaxaAccountDataSource()
        ecotaxa_accountRepository = new EcotaxaAccountRepositoryImpl(mockEcotaxaAccountDataSource)
    })

    describe("CreateEcotaxaAccount", () => {
        test("Should create a ecotaxa_account", async () => {
            const ecotaxa_account: EcotaxaAccountRequestCreationModel = ecotaxaAccountRequestCreationModel

            jest.spyOn(mockEcotaxaAccountDataSource, 'create').mockResolvedValue(1)

            const result = await ecotaxa_accountRepository.createEcotaxaAccount(ecotaxa_account)

            expect(mockEcotaxaAccountDataSource.create).toBeCalledWith(ecotaxa_account)
            expect(result).toBe(1)
        })
    })

    describe("ConnectToEcotaxaInstance", () => {
        test("Should connect to ecotaxa instance", async () => {
            const ecotaxa_account: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model_test_user

            jest.spyOn(mockEcotaxaAccountDataSource, 'getOneEcoTaxaInstance').mockResolvedValue(ecotaxa_instance_test_ecotaxa)

            const result = await ecotaxa_accountRepository.connectToEcotaxaInstance(ecotaxa_account)

            expect(mockEcotaxaAccountDataSource.getOneEcoTaxaInstance).toBeCalledWith(ecotaxa_account.ecotaxa_instance_id)
            expect(result).toHaveProperty('ecotaxa_expiration_date');
            expect(result).toHaveProperty('ecotaxa_token');
            expect(result).toHaveProperty('ecotaxa_user_name');

            // expected expiration date is 30 days from now
            const expectedExpirationDate = new Date();
            expectedExpirationDate.setDate(expectedExpirationDate.getDate() + 30);
            const formattedExpectedExpirationDate = expectedExpirationDate.toISOString().split('T')[0];
            // given expiration date
            const actualExpirationDate = new Date(result.ecotaxa_expiration_date).toISOString().split('T')[0];

            expect(actualExpirationDate).toBe(formattedExpectedExpirationDate);
            expect(typeof result.ecotaxa_token).toBe('string');
            expect(result.ecotaxa_user_name).toBe('Test API user');
        });
        test("Should throw an error if cannot connect to ecotaxa account", async () => {
            const unexisting_ecotaxa_account: PublicEcotaxaAccountRequestCreationModel = public_ecotaxa_request_creation_model

            jest.spyOn(mockEcotaxaAccountDataSource, 'getOneEcoTaxaInstance').mockResolvedValue(ecotaxa_instance_test_ecotaxa)

            try { await ecotaxa_accountRepository.connectToEcotaxaInstance(unexisting_ecotaxa_account) }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("HTTP Error: 403")
            }
            expect(mockEcotaxaAccountDataSource.getOneEcoTaxaInstance).toBeCalledWith(unexisting_ecotaxa_account.ecotaxa_instance_id)
        });

    });

    describe("accountExists", () => {
        test("Should get tell if accountExists", async () => {

            jest.spyOn(mockEcotaxaAccountDataSource, 'getAll').mockResolvedValue(searchhResultEcotaxaAccountResponseModel)

            const result = await ecotaxa_accountRepository.accountExists(public_ecotaxa_request_creation_model)

            expect(mockEcotaxaAccountDataSource.getAll).toBeCalledWith({
                filter: [
                    {
                        field: "ecotaxa_account_instance_id",
                        operator: "=",
                        value: 1,
                    },
                    {
                        field: "ecotaxa_account_user_email",
                        operator: "=",
                        value: "lena@gmail.com",
                    },
                    {
                        field: "ecotaxa_account_ecopart_user_id",
                        operator: "=",
                        value: 1,
                    },
                ],
                limit: 99999,
                page: 1,
                sort_by: [],
            })
            expect(result).toBe(true)
        });
    });
    describe("GetOneEcotaxaAccount", () => {
        test("Should get one ecotaxa account", async () => {
            const ecotaxa_account_id = 1

            jest.spyOn(mockEcotaxaAccountDataSource, 'getOne').mockResolvedValue(ecotaxaAccountResponseModel_1)

            const result = await ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_account_id)

            expect(mockEcotaxaAccountDataSource.getOne).toBeCalledWith(ecotaxa_account_id)
            expect(result).toBe(ecotaxaAccountResponseModel_1)
        })
        test("Should return null if ecotaxa account not found", async () => {
            const ecotaxa_account_id = 1

            jest.spyOn(mockEcotaxaAccountDataSource, 'getOne').mockResolvedValue(null)

            const result = await ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_account_id)

            expect(mockEcotaxaAccountDataSource.getOne).toBeCalledWith(ecotaxa_account_id)
            expect(result).toBe(null)
        });
        test("Should return null if the ecopart_user_id is specified and does not match the ecotaxa_account", async () => {
            const ecotaxa_account_id = 1
            const ecopart_user_id = 2

            jest.spyOn(mockEcotaxaAccountDataSource, 'getOne').mockResolvedValue(ecotaxaAccountResponseModel_1)

            const result = await ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_account_id, ecopart_user_id)

            expect(mockEcotaxaAccountDataSource.getOne).toBeCalledWith(ecotaxa_account_id)
            expect(result).toBe(null)
        });
    });
    describe("FormatEcotaxaAccountResponse", () => {
        test("Should format ecotaxa account response", () => {
            const ecotaxa_account = ecotaxaAccountResponseModel_1

            const result = ecotaxa_accountRepository.formatEcotaxaAccountResponse(ecotaxa_account)

            expect(result).toEqual({
                ecotaxa_account_id: 3,
                ecotaxa_user_name: "ecotaxa_account_user_name",
                ecotaxa_expiration_date: "2025-03-19T16:49:24.892Z",
                ecotaxa_account_instance_id: 1,
                ecotaxa_account_instance_name: "FR"
            })
        });
    });
    describe("deleteEcotaxaAccount", () => {
        test("Should delete ecotaxa account", async () => {
            const ecotaxa_account = ecotaxaAccountResponseModel_1

            jest.spyOn(mockEcotaxaAccountDataSource, 'deleteOne').mockResolvedValue(1)

            const result = await ecotaxa_accountRepository.deleteEcotaxaAccount(ecotaxa_account)

            expect(mockEcotaxaAccountDataSource.deleteOne).toBeCalledWith(ecotaxa_account)
            expect(result).toBe(1)
        })
        test("Should throw an error if cannot delete ecotaxa account", async () => {
            const ecotaxa_account = ecotaxaAccountResponseModel_1

            jest.spyOn(mockEcotaxaAccountDataSource, 'deleteOne').mockResolvedValue(0)

            try { await ecotaxa_accountRepository.deleteEcotaxaAccount(ecotaxa_account) }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Ecotaxa account not found")
            }
            expect(mockEcotaxaAccountDataSource.deleteOne).toBeCalledWith(ecotaxa_account)
        });
    });

    describe("standardGetEcotaxaAccountsModels", () => {
        test("Should get ecotaxa accounts with no filters", async () => {
            const options = {
                filter: [],
                limit: 10,
                page: 1,
                sort_by: []
            }

            jest.spyOn(mockEcotaxaAccountDataSource, 'getAll').mockResolvedValue(searchhResultEcotaxaAccountResponseModel)

            const result = await ecotaxa_accountRepository.standardGetEcotaxaAccountsModels(options)

            expect(mockEcotaxaAccountDataSource.getAll).toBeCalledWith(options)
            expect(result).toBe(searchhResultEcotaxaAccountResponseModel)
        });
        test("Should get ecotaxa accounts with good filters", async () => {
            const options: PreparedSearchOptions = {
                filter: [{
                    field: "ecotaxa_account_ecopart_user_id",
                    operator: "=",
                    value: 1
                }],
                limit: 10,
                page: 1,
                sort_by: [{
                    sort_by: "ecotaxa_account_expiration_date",
                    order_by: "asc"
                }]
            }

            jest.spyOn(mockEcotaxaAccountDataSource, 'getAll').mockResolvedValue(searchhResultEcotaxaAccountResponseModel)

            const result = await ecotaxa_accountRepository.standardGetEcotaxaAccountsModels(options)

            expect(mockEcotaxaAccountDataSource.getAll).toBeCalledWith(options)
            expect(result).toBe(searchhResultEcotaxaAccountResponseModel)
        });
        test("Should throw an error if unauthorized params", async () => {
            const options: PreparedSearchOptions = {
                filter: [{
                    field: "ecotaxa_account_expiration_date",
                    operator: "-",
                    value: 1
                }],
                limit: 10,
                page: 1,
                sort_by: [{
                    sort_by: "ecotaxa_account_ecopart_user_id",
                    order_by: "toto"
                }]
            }

            try { await ecotaxa_accountRepository.standardGetEcotaxaAccountsModels(options) }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized sort_by: ecotaxa_account_ecopart_user_id, Unauthorized order_by: toto, Filter field: ecotaxa_account_expiration_date, Filter operator: -")
            }
        });
    });
})


