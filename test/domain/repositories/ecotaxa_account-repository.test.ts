//test/domain/repositories/ecotaxa_account-repository.test.ts
import { EcotaxaAccountDataSource } from "../../../src/data/interfaces/data-sources/ecotaxa_account-data-source";
import { EcotaxaAccountRequestCreationModel, PublicEcotaxaAccountRequestCreationModel } from "../../../src/domain/entities/ecotaxa_account";
import { ProjectResponseModel, PublicProjectUpdateModel } from "../../../src/domain/entities/project";
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
        ecotaxa_accountRepository = new EcotaxaAccountRepositoryImpl(mockEcotaxaAccountDataSource, "julie.coustenoble@imev-mer.fr", "TST")
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
                expect(e.message).toContain("Cannot login into EcoTaxa")
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

            jest.spyOn(mockEcotaxaAccountDataSource, 'getAll').mockResolvedValue({ total: 1, items: [ecotaxaAccountResponseModel_1] })

            const result = await ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_account_id)

            expect(mockEcotaxaAccountDataSource.getAll).toBeCalledWith({
                filter: [{ field: "ecotaxa_account_id", operator: "=", value: ecotaxa_account_id }],
                sort_by: [],
                page: 1,
                limit: 1
            })
            expect(result).toStrictEqual(ecotaxaAccountResponseModel_1)
        })
        test("Should return null if ecotaxa account not found", async () => {
            const ecotaxa_account_id = 1

            jest.spyOn(mockEcotaxaAccountDataSource, 'getAll').mockResolvedValue({ total: 0, items: [] })

            const result = await ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_account_id)

            expect(mockEcotaxaAccountDataSource.getAll).toBeCalledWith({
                filter: [{ field: "ecotaxa_account_id", operator: "=", value: ecotaxa_account_id }],
                sort_by: [],
                page: 1,
                limit: 1
            })
            expect(result).toBe(null)
        });
        test("Should return null if the ecopart_user_id is specified and does not match the ecotaxa_account", async () => {
            const ecotaxa_account_id = 1
            const ecopart_user_id = 2

            jest.spyOn(mockEcotaxaAccountDataSource, 'getAll').mockResolvedValue({ total: 0, items: [] })

            const result = await ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_account_id, ecopart_user_id)

            expect(mockEcotaxaAccountDataSource.getAll).toBeCalledWith({
                filter: [
                    { field: "ecotaxa_account_id", operator: "=", value: ecotaxa_account_id },
                    { field: "ecotaxa_account_ecopart_user_id", operator: "=", value: ecopart_user_id }
                ],
                sort_by: [],
                page: 1,
                limit: 1
            })
            expect(result).toBe(null)
        });
    });
    describe("FormatEcotaxaAccountResponse", () => {
        test("Should format ecotaxa account response", () => {
            const ecotaxa_account = ecotaxaAccountResponseModel_1

            const result = ecotaxa_accountRepository.formatEcotaxaAccountResponse(ecotaxa_account)

            expect(result).toEqual({
                ecotaxa_account_id: 3,
                ecotaxa_account_ecotaxa_id: 1,
                ecotaxa_user_name: "ecotaxa_account_user_name",
                ecotaxa_user_email: "ecotaxa_account_user_email",
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
            expect(result).toStrictEqual(searchhResultEcotaxaAccountResponseModel)
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
                    sort_by: "ecotaxa_account_expiration_utc_date_time",
                    order_by: "asc"
                }]
            }

            jest.spyOn(mockEcotaxaAccountDataSource, 'getAll').mockResolvedValue(searchhResultEcotaxaAccountResponseModel)

            const result = await ecotaxa_accountRepository.standardGetEcotaxaAccountsModels(options)

            expect(mockEcotaxaAccountDataSource.getAll).toBeCalledWith(options)
            expect(result).toStrictEqual(searchhResultEcotaxaAccountResponseModel)
        });
        test("Should throw an error if unauthorized params", async () => {
            const options: PreparedSearchOptions = {
                filter: [{
                    field: "ecotaxa_account_expiration_utc_date_time",
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
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized sort_by: ecotaxa_account_ecopart_user_id, Unauthorized order_by: toto, Filter field: ecotaxa_account_expiration_utc_date_time, Filter operator: -")
            }
        });
    });

    describe("EcoTaxa project PATCH", () => {
        let repositoryImpl: EcotaxaAccountRepositoryImpl;
        const contact = { id: 10, name: "owner", email: "owner@test.fr", organisation: "LOV" };
        const generic_manager = { id: 1, name: "ecotaxa_account_user_name", email: "ecotaxa_account_user_email", organisation: "" };
        const ecotaxa_project = () => ({
            projid: 42,
            title: "EcoTaxa project",
            instrument: "UVP6",
            access: "0",
            highest_right: "Manage",
            cnn_network_id: null,
            managers: [contact],
            annotators: [],
            viewers: [],
            contact,
        });

        beforeEach(() => {
            repositoryImpl = new EcotaxaAccountRepositoryImpl(mockEcotaxaAccountDataSource, "julie.coustenoble@imev-mer.fr", "TST")
            jest.spyOn(repositoryImpl, "getEcotaxaGenericAccountForInstance").mockResolvedValue(ecotaxaAccountResponseModel_1)
            jest.spyOn(repositoryImpl, "api_patch_ecotaxa_project").mockResolvedValue()
        })

        test("Should patch only cnn, managers and contact when adding default values", async () => {
            await repositoryImpl.add_default_values_to_ecotaxa_project(ecotaxa_instance_test_ecotaxa, ecotaxaAccountResponseModel_1, ecotaxa_project())

            expect(repositoryImpl.api_patch_ecotaxa_project).toBeCalledTimes(1)
            expect(repositoryImpl.api_patch_ecotaxa_project).toBeCalledWith(
                ecotaxa_instance_test_ecotaxa.ecotaxa_instance_url,
                ecotaxaAccountResponseModel_1.ecotaxa_account_token,
                42,
                { cnn_network_id: "uvp6_beta_2022-01-26", managers: [contact, generic_manager], contact }
            )
        });

        test("Should not duplicate the generic account nor change an existing cnn", async () => {
            const project = { ...ecotaxa_project(), cnn_network_id: "custom_cnn", managers: [contact, generic_manager] }

            await repositoryImpl.add_default_values_to_ecotaxa_project(ecotaxa_instance_test_ecotaxa, ecotaxaAccountResponseModel_1, project)

            expect(repositoryImpl.api_patch_ecotaxa_project).toBeCalledWith(
                ecotaxa_instance_test_ecotaxa.ecotaxa_instance_url,
                ecotaxaAccountResponseModel_1.ecotaxa_account_token,
                42,
                { cnn_network_id: "custom_cnn", managers: [contact, generic_manager], contact }
            )
        });

        test("Should patch managers without the generic account and keep the contact when unlinking", async () => {
            const project = { ...ecotaxa_project(), managers: [contact, generic_manager] }
            jest.spyOn(repositoryImpl, "getOneEcoTaxaInstance").mockResolvedValue(ecotaxa_instance_test_ecotaxa)
            jest.spyOn(repositoryImpl, "getOneEcotaxaAccount").mockResolvedValue(ecotaxaAccountResponseModel_1)
            jest.spyOn(repositoryImpl, "api_get_ecotaxa_project").mockResolvedValue(project)

            await repositoryImpl.deleteEcopartUserFromEcotaxaProject(
                { ecotaxa_instance_id: 1, ecotaxa_project_id: 42 } as ProjectResponseModel,
                { ecotaxa_account_id: 3 } as PublicProjectUpdateModel
            )

            expect(repositoryImpl.api_patch_ecotaxa_project).toBeCalledTimes(1)
            expect(repositoryImpl.api_patch_ecotaxa_project).toBeCalledWith(
                ecotaxa_instance_test_ecotaxa.ecotaxa_instance_url,
                ecotaxaAccountResponseModel_1.ecotaxa_account_token,
                42,
                { managers: [contact], contact }
            )
        });
    });

    describe("pollJobUntilDone", () => {
        const status = (state: string, progress_pct: number) => ({ state, progress_pct, progress_msg: `step ${progress_pct}`, updated_on: `2026-10-13T15:00:${progress_pct}` });
        const poll = (opts: { intervalMs: number, stallMinutes: number }) =>
            (ecotaxa_accountRepository as EcotaxaAccountRepositoryImpl).pollJobUntilDone("https://ecotaxa.test/", "token", 7, opts);

        test("keeps waiting past the stall delay while the job progresses", async () => {
            const http = jest.spyOn(ecotaxa_accountRepository as any, "http");
            for (let pct = 0; pct < 10; pct++) http.mockResolvedValueOnce(status("R", pct));
            http.mockResolvedValueOnce(status("F", 100));

            // 10 polls of 10 ms each outlast the 30 ms stall delay, a total cap would have failed.
            await expect(poll({ intervalMs: 10, stallMinutes: 0.0005 })).resolves.toEqual(status("F", 100));
            expect(http).toBeCalledTimes(11);
        });

        test("fails when the job reports no progress for the stall delay", async () => {
            jest.spyOn(ecotaxa_accountRepository as any, "http").mockResolvedValue(status("R", 40));

            await expect(poll({ intervalMs: 5, stallMinutes: 0.0005 })).rejects.toThrow("EcoTaxa job 7 made no progress for 0.0005 minutes (state R, 40% step 40).");
        });

        test("fails at once when the job ends in error", async () => {
            const http = jest.spyOn(ecotaxa_accountRepository as any, "http").mockResolvedValueOnce(status("E", 10));

            await expect(poll({ intervalMs: 5, stallMinutes: 30 })).rejects.toThrow("Failed to poll job status for job 7: Import job failed");
            expect(http).toBeCalledTimes(1);
        });
    });
})
