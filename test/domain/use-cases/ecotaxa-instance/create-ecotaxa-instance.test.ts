import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { CreateEcoTaxaInstance } from '../../../../src/domain/use-cases/ecotaxa_instance/create-ecotaxa-instance';
import { ecotaxa_instance_1 } from "../../../entities/user";
import { EcotaxaInstanceRequestCreationModel } from "../../../../src/domain/entities/ecotaxa_account";
import { UserUpdateModel } from "../../../../src/domain/entities/user";

let mockUserRepository: UserRepository;
let mockEcotaxaAccountRepository: EcotaxaAccountRepository;

const current_user: UserUpdateModel = {
    user_id: 1,
}

const instance_to_create: EcotaxaInstanceRequestCreationModel = {
    ecotaxa_instance_name: "FR",
    ecotaxa_instance_description: "FR instance",
    ecotaxa_instance_url: "http://localhost:8080/"
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository()
})

describe("Domain - Use Cases - Create EcoTaxa Instance", () => {
    test("Should create an ecotaxa instance when user is admin", async () => {
        jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed')
            .mockResolvedValueOnce();
        jest.spyOn(mockUserRepository, 'isAdmin')
            .mockResolvedValueOnce(true);
        jest.spyOn(mockEcotaxaAccountRepository, 'createEcoTaxaInstance')
            .mockResolvedValueOnce(1);
        jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance')
            .mockResolvedValueOnce(ecotaxa_instance_1);

        const createUseCase = new CreateEcoTaxaInstance(mockUserRepository, mockEcotaxaAccountRepository);
        const result = await createUseCase.execute(current_user, instance_to_create);

        expect(result).toStrictEqual(ecotaxa_instance_1);
        expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toHaveBeenCalledWith(current_user.user_id);
        expect(mockEcotaxaAccountRepository.createEcoTaxaInstance).toHaveBeenCalledWith(instance_to_create);
        expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toHaveBeenCalledWith(1);
    });

    test("Should throw when user is not admin", async () => {
        jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed')
            .mockResolvedValueOnce();
        jest.spyOn(mockUserRepository, 'isAdmin')
            .mockResolvedValueOnce(false);
        jest.spyOn(mockEcotaxaAccountRepository, 'createEcoTaxaInstance');

        const createUseCase = new CreateEcoTaxaInstance(mockUserRepository, mockEcotaxaAccountRepository);

        try {
            await createUseCase.execute(current_user, instance_to_create);
            expect(true).toBe(false); // Should not reach here
        } catch (error) {
            expect(error.message).toBe("Logged user cannot create an EcoTaxa instance");
        }

        expect(mockEcotaxaAccountRepository.createEcoTaxaInstance).not.toHaveBeenCalled();
    });

    test("Should throw when user cannot be used (deleted)", async () => {
        jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed')
            .mockRejectedValueOnce(new Error("User is deleted"));
        jest.spyOn(mockUserRepository, 'isAdmin');
        jest.spyOn(mockEcotaxaAccountRepository, 'createEcoTaxaInstance');

        const createUseCase = new CreateEcoTaxaInstance(mockUserRepository, mockEcotaxaAccountRepository);

        try {
            await createUseCase.execute(current_user, instance_to_create);
            expect(true).toBe(false);
        } catch (error) {
            expect(error.message).toBe("User is deleted");
        }

        expect(mockUserRepository.isAdmin).not.toHaveBeenCalled();
        expect(mockEcotaxaAccountRepository.createEcoTaxaInstance).not.toHaveBeenCalled();
    });

    test("Should throw when created instance cannot be found", async () => {
        jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed')
            .mockResolvedValueOnce();
        jest.spyOn(mockUserRepository, 'isAdmin')
            .mockResolvedValueOnce(true);
        jest.spyOn(mockEcotaxaAccountRepository, 'createEcoTaxaInstance')
            .mockResolvedValueOnce(99);
        jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance')
            .mockResolvedValueOnce(null);

        const createUseCase = new CreateEcoTaxaInstance(mockUserRepository, mockEcotaxaAccountRepository);

        try {
            await createUseCase.execute(current_user, instance_to_create);
            expect(true).toBe(false);
        } catch (error) {
            expect(error.message).toBe("Cannot find created EcoTaxa instance");
        }
    });
});
