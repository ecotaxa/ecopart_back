import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { SearchOptions, SearchResult } from "../../../../src/domain/entities/search";
import { EcoTaxaSampleSummary } from "../../../../src/domain/entities/sample";
import { PublicProjectResponseModel } from "../../../../src/domain/entities/project";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";
import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { SearchEcoTaxaSamples } from "../../../../src/domain/use-cases/ecotaxa_sample/search-ecotaxa-samples";
import { MockUserRepository, MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSearchRepository } from "../../../mocks/search-mock";

let userRepo: UserRepository;
let sampleRepo: SampleRepository;
let privilegeRepo: PrivilegeRepository;
let projectRepo: ProjectRepository;
let searchRepo: SearchRepository;
let ecotaxaRepo: EcotaxaAccountRepository;
let useCase: SearchEcoTaxaSamples;

const current_user: UserUpdateModel = { user_id: 1 };
const baseOptions: SearchOptions = { page: 1, limit: 10, sort_by: "" };
const project = { project_id: 10, ecotaxa_instance_id: 3 } as PublicProjectResponseModel;

beforeEach(() => {
    jest.clearAllMocks();
    userRepo = new MockUserRepository();
    sampleRepo = new MockSampleRepository();
    privilegeRepo = new MockPrivilegeRepository();
    projectRepo = new MockProjectRepository();
    searchRepo = new MockSearchRepository();
    ecotaxaRepo = new MockEcotaxaAccountRepository();
    useCase = new SearchEcoTaxaSamples(userRepo, sampleRepo, privilegeRepo, projectRepo, searchRepo, ecotaxaRepo);
});

describe("SearchEcoTaxaSamples use case", () => {
    test("throws when user cannot be used", async () => {
        jest.spyOn(userRepo, "ensureUserCanBeUsed").mockRejectedValueOnce(new Error("User cannot be used"));
        const isAdminSpy = jest.spyOn(userRepo, "isAdmin");
        await expect(useCase.execute(current_user, baseOptions, [], 10)).rejects.toThrow("User cannot be used");
        expect(isAdminSpy).not.toHaveBeenCalled();
    });

    test("throws when non-admin user has no privilege on the project", async () => {
        jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValueOnce(undefined);
        jest.spyOn(userRepo, "isAdmin").mockResolvedValueOnce(false);
        jest.spyOn(privilegeRepo, "isGranted").mockResolvedValueOnce(false);
        const getProjectSpy = jest.spyOn(projectRepo, "getProject");

        await expect(useCase.execute(current_user, baseOptions, [], 10))
            .rejects.toThrow("Logged user cannot get EcoTaxa samples for this project");
        expect(getProjectSpy).not.toHaveBeenCalled();
    });

    test("admin skips privilege check and returns zipped stats", async () => {
        const summaries: SearchResult<EcoTaxaSampleSummary> = {
            total: 2,
            items: [
                { sample_id: 1, sample_name: "stn001", ecotaxa_sample_id: 100 },
                { sample_id: 2, sample_name: "stn002", ecotaxa_sample_id: 200 },
            ],
        };
        jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValueOnce(undefined);
        jest.spyOn(userRepo, "isAdmin").mockResolvedValueOnce(true);
        const isGrantedSpy = jest.spyOn(privilegeRepo, "isGranted");
        jest.spyOn(projectRepo, "getProject").mockResolvedValueOnce(project);
        jest.spyOn(searchRepo, "formatSortBy").mockReturnValueOnce([]);
        jest.spyOn(sampleRepo, "standardGetEcoTaxaSampleSummaries").mockResolvedValueOnce(summaries);
        jest.spyOn(searchRepo, "formatSearchInfo").mockReturnValueOnce({ total: 2, limit: 10, total_on_page: 2, page: 1, pages: 1 });
        jest.spyOn(ecotaxaRepo, "getOneEcoTaxaInstance").mockResolvedValueOnce({ ecotaxa_instance_id: 3, ecotaxa_instance_url: "https://ecotaxa.example/" } as any);
        jest.spyOn(ecotaxaRepo, "getEcotaxaGenericAccountForInstance").mockResolvedValueOnce({ ecotaxa_account_token: "tok" } as any);
        jest.spyOn(ecotaxaRepo, "api_ecotaxa_get_sample_stats").mockResolvedValueOnce([
            { sample_id: 100, used_taxa: [], nb_unclassified: 10, nb_validated: 5, nb_dubious: 1, nb_predicted: 4, projid: 999 },
            { sample_id: 200, used_taxa: [], nb_unclassified: 0, nb_validated: 20, nb_dubious: 0, nb_predicted: 0, projid: 999 },
        ]);

        const result = await useCase.execute(current_user, baseOptions, [], 10);

        expect(isGrantedSpy).not.toHaveBeenCalled();
        expect(result.search_info.total).toBe(2);
        expect(result.items).toEqual([
            { sample_id: 1, sample_name: "stn001", ecotaxa_sample_id: 100, nb_objects: 20, nb_unclassified: 10, nb_validated: 5, nb_dubious: 1, nb_predicted: 4 },
            { sample_id: 2, sample_name: "stn002", ecotaxa_sample_id: 200, nb_objects: 20, nb_unclassified: 0, nb_validated: 20, nb_dubious: 0, nb_predicted: 0 },
        ]);
        expect(ecotaxaRepo.api_ecotaxa_get_sample_stats).toHaveBeenCalledWith("https://ecotaxa.example/", "tok", [100, 200]);
    });

    test("forces project_id and ecotaxa_sample_imported filters even if caller supplied them", async () => {
        jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValueOnce(undefined);
        jest.spyOn(userRepo, "isAdmin").mockResolvedValueOnce(true);
        jest.spyOn(projectRepo, "getProject").mockResolvedValueOnce(project);
        jest.spyOn(searchRepo, "formatFilters").mockImplementation(f => f);
        jest.spyOn(searchRepo, "formatSortBy").mockReturnValueOnce([]);
        const repoSpy = jest.spyOn(sampleRepo, "standardGetEcoTaxaSampleSummaries").mockResolvedValueOnce({ total: 0, items: [] });
        jest.spyOn(searchRepo, "formatSearchInfo").mockReturnValueOnce({ total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 });

        await useCase.execute(current_user, baseOptions, [
            { field: "project_id", operator: "=", value: 9999 },
            { field: "ecotaxa_sample_imported", operator: "=", value: false },
            { field: "sample_name", operator: "LIKE", value: "%foo%" },
        ], 10);

        const passed = repoSpy.mock.calls[0][0];
        expect(passed.filter).toContainEqual({ field: "project_id", operator: "=", value: 10 });
        expect(passed.filter).toContainEqual({ field: "ecotaxa_sample_imported", operator: "=", value: true });
        expect(passed.filter.some(f => f.field === "project_id" && f.value === 9999)).toBe(false);
        expect(passed.filter.some(f => f.field === "ecotaxa_sample_imported" && f.value === false)).toBe(false);
        expect(passed.filter).toContainEqual({ field: "sample_name", operator: "LIKE", value: "%foo%" });
    });

    test("samples without matching EcoTaxa stats get zero counts", async () => {
        const summaries: SearchResult<EcoTaxaSampleSummary> = {
            total: 1,
            items: [{ sample_id: 1, sample_name: "stn001", ecotaxa_sample_id: 100 }],
        };
        jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValueOnce(undefined);
        jest.spyOn(userRepo, "isAdmin").mockResolvedValueOnce(true);
        jest.spyOn(projectRepo, "getProject").mockResolvedValueOnce(project);
        jest.spyOn(searchRepo, "formatSortBy").mockReturnValueOnce([]);
        jest.spyOn(sampleRepo, "standardGetEcoTaxaSampleSummaries").mockResolvedValueOnce(summaries);
        jest.spyOn(searchRepo, "formatSearchInfo").mockReturnValueOnce({ total: 1, limit: 10, total_on_page: 1, page: 1, pages: 1 });
        jest.spyOn(ecotaxaRepo, "getOneEcoTaxaInstance").mockResolvedValueOnce({ ecotaxa_instance_url: "u" } as any);
        jest.spyOn(ecotaxaRepo, "getEcotaxaGenericAccountForInstance").mockResolvedValueOnce({ ecotaxa_account_token: "t" } as any);
        jest.spyOn(ecotaxaRepo, "api_ecotaxa_get_sample_stats").mockResolvedValueOnce([]);

        const result = await useCase.execute(current_user, baseOptions, [], 10);

        expect(result.items).toEqual([
            { sample_id: 1, sample_name: "stn001", ecotaxa_sample_id: 100, nb_objects: 0, nb_unclassified: 0, nb_validated: 0, nb_dubious: 0, nb_predicted: 0 },
        ]);
    });

    test("skips EcoTaxa call when there are no summaries on the page", async () => {
        jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValueOnce(undefined);
        jest.spyOn(userRepo, "isAdmin").mockResolvedValueOnce(true);
        jest.spyOn(projectRepo, "getProject").mockResolvedValueOnce(project);
        jest.spyOn(searchRepo, "formatSortBy").mockReturnValueOnce([]);
        jest.spyOn(sampleRepo, "standardGetEcoTaxaSampleSummaries").mockResolvedValueOnce({ total: 0, items: [] });
        jest.spyOn(searchRepo, "formatSearchInfo").mockReturnValueOnce({ total: 0, limit: 10, total_on_page: 0, page: 1, pages: 0 });
        const statsSpy = jest.spyOn(ecotaxaRepo, "api_ecotaxa_get_sample_stats");
        const instanceSpy = jest.spyOn(ecotaxaRepo, "getOneEcoTaxaInstance");

        const result = await useCase.execute(current_user, baseOptions, [], 10);

        expect(result.items).toEqual([]);
        expect(statsSpy).not.toHaveBeenCalled();
        expect(instanceSpy).not.toHaveBeenCalled();
    });

    test("throws when project is not linked to an EcoTaxa instance", async () => {
        jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValueOnce(undefined);
        jest.spyOn(userRepo, "isAdmin").mockResolvedValueOnce(true);
        jest.spyOn(projectRepo, "getProject").mockResolvedValueOnce({ project_id: 10, ecotaxa_instance_id: null } as PublicProjectResponseModel);

        await expect(useCase.execute(current_user, baseOptions, [], 10))
            .rejects.toThrow("Project is not linked to an EcoTaxa instance");
    });
});
