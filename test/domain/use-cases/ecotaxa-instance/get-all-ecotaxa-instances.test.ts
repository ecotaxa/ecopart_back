import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { GetAllEcoTaxaInstances } from '../../../../src/domain/use-cases/ecotaxa_instance/get-all-ecotaxa-instances';
import { ecotaxa_instance_1, ecotaxa_instance_test_ecotaxa } from "../../../entities/user";

let mockEcotaxaAccountRepository: EcotaxaAccountRepository;

beforeEach(() => {
    jest.clearAllMocks();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository()
})

describe("Domain - Use Cases - Get All EcoTaxa Instances", () => {
    test("Should return all ecotaxa instances", async () => {
        const expectedInstances = [ecotaxa_instance_1, ecotaxa_instance_test_ecotaxa];

        jest.spyOn(mockEcotaxaAccountRepository, 'getAllEcoTaxaInstances')
            .mockResolvedValueOnce(expectedInstances);

        const getAllUseCase = new GetAllEcoTaxaInstances(mockEcotaxaAccountRepository);
        const result = await getAllUseCase.execute();

        expect(result).toStrictEqual(expectedInstances);
        expect(result.length).toBe(2);
        expect(mockEcotaxaAccountRepository.getAllEcoTaxaInstances).toHaveBeenCalledTimes(1);
    });

    test("Should return empty array when no instances exist", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, 'getAllEcoTaxaInstances')
            .mockResolvedValueOnce([]);

        const getAllUseCase = new GetAllEcoTaxaInstances(mockEcotaxaAccountRepository);
        const result = await getAllUseCase.execute();

        expect(result).toStrictEqual([]);
        expect(result.length).toBe(0);
        expect(mockEcotaxaAccountRepository.getAllEcoTaxaInstances).toHaveBeenCalledTimes(1);
    });

    test("Should throw when repository fails", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, 'getAllEcoTaxaInstances')
            .mockRejectedValueOnce(new Error("Database error"));

        const getAllUseCase = new GetAllEcoTaxaInstances(mockEcotaxaAccountRepository);

        try {
            await getAllUseCase.execute();
            expect(true).toBe(false); // Should not reach here
        } catch (error) {
            expect(error.message).toBe("Database error");
        }
    });
});
