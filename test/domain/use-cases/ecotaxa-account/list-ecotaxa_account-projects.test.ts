import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { ListEcotaxaAccountProjects } from "../../../../src/domain/use-cases/ecotaxa_account/list-ecotaxa_account-projects";
import { ecotaxaAccountResponseModel } from "../../../entities/user";
import { EcotaxaAccountResponseModel } from "../../../../src/domain/entities/ecotaxa_account";

let mockEcotaxaAccountRepository: MockEcotaxaAccountRepository;
let mockUserRepository: MockUserRepository;
let mockProjectRepository: MockProjectRepository;
let useCase: ListEcotaxaAccountProjects;

// The fixture account expired in 2025: a valid session lasts until tomorrow.
const validAccount: EcotaxaAccountResponseModel = {
    ...ecotaxaAccountResponseModel,
    ecotaxa_account_expiration_utc_date_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
};

const searched = [
    { projid: 10, title: "old", instrument: "UVP6", status: "Annotate", objcount: 5, pctvalidated: 20 },
    { projid: 42, title: "recent", instrument: "UVP6", status: "Annotate", objcount: null, pctvalidated: null },
];

beforeEach(() => {
    jest.clearAllMocks();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
    mockUserRepository = new MockUserRepository();
    mockProjectRepository = new MockProjectRepository();
    useCase = new ListEcotaxaAccountProjects(mockUserRepository, mockEcotaxaAccountRepository, mockProjectRepository);
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
});

describe("Domain - Use Cases - List EcoTaxa account projects", () => {
    test("lists the manageable projects, most recent first, and flags the linked ones", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(validAccount);
        jest.spyOn(mockEcotaxaAccountRepository, "listManageableEcotaxaProjects").mockResolvedValueOnce(searched);
        jest.spyOn(mockProjectRepository, "getLinkedEcotaxaProjectIds").mockResolvedValueOnce(new Set([10]));

        const result = await useCase.execute({ user_id: 1 }, 1, 3, "UVP6LP");

        expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).toHaveBeenCalledWith(3, 1);
        expect(mockEcotaxaAccountRepository.listManageableEcotaxaProjects).toHaveBeenCalledWith(validAccount, "UVP6LP");
        expect(mockProjectRepository.getLinkedEcotaxaProjectIds).toHaveBeenCalledWith(validAccount.ecotaxa_account_instance_id);
        expect(result).toStrictEqual([
            { ecotaxa_project_id: 42, ecotaxa_project_title: "recent", ecotaxa_project_instrument: "UVP6", ecotaxa_project_object_count: null, ecotaxa_project_validated_pct: null, already_linked: false },
            { ecotaxa_project_id: 10, ecotaxa_project_title: "old", ecotaxa_project_instrument: "UVP6", ecotaxa_project_object_count: 5, ecotaxa_project_validated_pct: 20, already_linked: true },
        ]);
    });

    test("refuses the EcoTaxa account of another user, even for an admin", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount");

        await expect(useCase.execute({ user_id: 1 }, 2, 3)).rejects.toThrow("User cannot list the projects of this ecotaxa account");
        expect(mockEcotaxaAccountRepository.getOneEcotaxaAccount).not.toHaveBeenCalled();
    });

    test("fails when the logged user cannot be used", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValueOnce(new Error("User cannot be used"));

        await expect(useCase.execute({ user_id: 1 }, 1, 3)).rejects.toThrow("User cannot be used");
    });

    test("fails when the EcoTaxa account is not found", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(null);

        await expect(useCase.execute({ user_id: 1 }, 1, 3)).rejects.toThrow("Ecotaxa account not found");
    });

    test("fails without asking EcoTaxa when the account session has expired", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(ecotaxaAccountResponseModel);
        jest.spyOn(mockEcotaxaAccountRepository, "listManageableEcotaxaProjects");

        await expect(useCase.execute({ user_id: 1 }, 1, 3)).rejects.toThrow("Ecotaxa account session expired");
        expect(mockEcotaxaAccountRepository.listManageableEcotaxaProjects).not.toHaveBeenCalled();
    });

    test("reports a token EcoTaxa refuses as an expired session", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(validAccount);
        jest.spyOn(mockEcotaxaAccountRepository, "listManageableEcotaxaProjects").mockRejectedValueOnce(new Error("HTTP 401 Unauthorized for https://ecotaxa/api/projects/search"));
        jest.spyOn(mockProjectRepository, "getLinkedEcotaxaProjectIds").mockResolvedValueOnce(new Set());

        await expect(useCase.execute({ user_id: 1 }, 1, 3)).rejects.toThrow("Ecotaxa account session expired");
    });

    test("passes any other EcoTaxa error through", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcotaxaAccount").mockResolvedValueOnce(validAccount);
        jest.spyOn(mockEcotaxaAccountRepository, "listManageableEcotaxaProjects").mockRejectedValueOnce(new Error("HTTP 500 Internal Server Error"));
        jest.spyOn(mockProjectRepository, "getLinkedEcotaxaProjectIds").mockResolvedValueOnce(new Set());

        await expect(useCase.execute({ user_id: 1 }, 1, 3)).rejects.toThrow("HTTP 500 Internal Server Error");
    });
});
