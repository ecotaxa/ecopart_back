import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { RefreshEcotaxaAccount } from "../../../../src/domain/use-cases/ecotaxa_account/refresh-ecotaxa_account";
import { ecotaxaAccountResponseModel } from "../../../entities/user";
import { EcotaxaAccountResponseModel, PublicEcotaxaAccountResponseModel } from "../../../../src/domain/entities/ecotaxa_account";

let mockEcotaxaAccountRepository: MockEcotaxaAccountRepository;
let mockUserRepository: MockUserRepository;
let useCase: RefreshEcotaxaAccount;

const refreshed: EcotaxaAccountResponseModel = {
    ...ecotaxaAccountResponseModel,
    ecotaxa_account_expiration_utc_date_time: "2030-01-01T00:00:00.000Z",
};
const formatted = { ecotaxa_account_id: refreshed.ecotaxa_account_id, ecotaxa_expiration_date: "2030-01-01T00:00:00.000Z" } as PublicEcotaxaAccountResponseModel;

beforeEach(() => {
    jest.clearAllMocks();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
    mockUserRepository = new MockUserRepository();
    useCase = new RefreshEcotaxaAccount(mockUserRepository, mockEcotaxaAccountRepository);
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
});

describe("Domain - Use Cases - Refresh EcoTaxa account", () => {
    test("refreshes the session of the owner's account and returns it formatted", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(ecotaxaAccountResponseModel);
        jest.spyOn(mockEcotaxaAccountRepository, "refreshEcotaxaAccountSession").mockResolvedValueOnce(refreshed);
        jest.spyOn(mockEcotaxaAccountRepository, "formatEcotaxaAccountResponse").mockReturnValueOnce(formatted);

        expect(await useCase.execute({ user_id: 1 }, 1, 3)).toBe(formatted);

        expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledWith(3, 1);
        expect(mockEcotaxaAccountRepository.refreshEcotaxaAccountSession).toHaveBeenCalledWith(3);
        expect(mockEcotaxaAccountRepository.formatEcotaxaAccountResponse).toHaveBeenCalledWith(refreshed);
    });

    test("an admin can refresh the account of another user", async () => {
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(ecotaxaAccountResponseModel);
        jest.spyOn(mockEcotaxaAccountRepository, "refreshEcotaxaAccountSession").mockResolvedValueOnce(refreshed);
        jest.spyOn(mockEcotaxaAccountRepository, "formatEcotaxaAccountResponse").mockReturnValueOnce(formatted);

        expect(await useCase.execute({ user_id: 9 }, 1, 3)).toBe(formatted);
        expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledWith(3, 1);
    });

    test("another user cannot refresh the account", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount");
        await expect(useCase.execute({ user_id: 2 }, 1, 3)).rejects.toThrow("User cannot refresh this ecotaxa account");
        expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).not.toHaveBeenCalled();
    });

    test("an account that is not the user's is not found", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(null);
        jest.spyOn(mockEcotaxaAccountRepository, "refreshEcotaxaAccountSession");

        await expect(useCase.execute({ user_id: 1 }, 1, 3)).rejects.toThrow("Ecotaxa account not found");
        expect(mockEcotaxaAccountRepository.refreshEcotaxaAccountSession).not.toHaveBeenCalled();
    });

    test("passes on the expired session when EcoTaxa refuses the refresh token", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(ecotaxaAccountResponseModel);
        jest.spyOn(mockEcotaxaAccountRepository, "refreshEcotaxaAccountSession").mockRejectedValueOnce(new Error("Ecotaxa account session expired"));

        await expect(useCase.execute({ user_id: 1 }, 1, 3)).rejects.toThrow("Ecotaxa account session expired");
    });
});
