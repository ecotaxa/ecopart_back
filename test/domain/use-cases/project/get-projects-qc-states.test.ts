import { StoredEcoTaxaStats } from "../../../../src/domain/entities/explore";
import { ProjectResponseModel } from "../../../../src/domain/entities/project";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { ExploreEcoTaxaService } from "../../../../src/domain/use-cases/explore/explore-ecotaxa";
import { GetProjectStats } from "../../../../src/domain/use-cases/project/get-project-stats";
import { GetProjectsQcStates, PROJECTS_QC_STATES_MAX } from "../../../../src/domain/use-cases/project/get-projects-qc-states";
import { buildProjectQcWarnings } from "../../../../src/domain/use-cases/project/project-stats";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { exploreProject, projectStatsSample } from "../explore/explore-fixtures";

const NOW = new Date("2026-10-23T12:00:00Z");
const current_user: UserUpdateModel = { user_id: 7 };

const LINKED: ProjectResponseModel = exploreProject(5, "open", {
    last_backup_utc_date_time: "2024-07-10T00:00:00.000Z",
    ecotaxa_project_id: 1234, ecotaxa_instance_id: 1,
});
const EMPTY: ProjectResponseModel = exploreProject(6, "private");

const SAMPLES = [
    projectStatsSample({ sample_id: 1, project_id: 5, ecotaxa_sample_imported: true, ecotaxa_sample_id: 9001, ctd_imported: true, sample_creation_utc_date_time: "2024-07-01T09:00:00.000Z" }),
    projectStatsSample({ sample_id: 2, project_id: 5, sample_creation_utc_date_time: "2024-07-11T09:00:00.000Z" }),
];
const STORED: StoredEcoTaxaStats[] = [
    { sample_id: 1, ecotaxa_sample_id: 9001, nb_unclassified: 0, nb_validated: 30, nb_dubious: 0, nb_predicted: 0, used_taxa: [45072], fetched_utc_date_time: "2026-10-23T00:00:00.000Z" },
];
const LINKED_WARNINGS = [
    { code: "samples_not_backed_up", nb_samples: 1 },
    { code: "samples_without_ctd", nb_samples: 1 },
    { code: "samples_not_imported_in_ecotaxa", nb_samples: 1 },
];

describe("GetProjectsQcStates use case", () => {
    let userRepository: MockUserRepository;
    let projectRepository: MockProjectRepository;
    let privilegeRepository: MockPrivilegeRepository;
    let sampleRepository: MockSampleRepository;
    let useCase: GetProjectsQcStates;

    beforeEach(() => {
        jest.clearAllMocks();
        userRepository = new MockUserRepository();
        projectRepository = new MockProjectRepository();
        privilegeRepository = new MockPrivilegeRepository();
        sampleRepository = new MockSampleRepository();
        useCase = new GetProjectsQcStates(userRepository, projectRepository, privilegeRepository, sampleRepository, () => NOW);

        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(userRepository, "isAdmin").mockResolvedValue(false);
        jest.spyOn(privilegeRepository, "getProjectsByUser").mockResolvedValue([5]);
        jest.spyOn(projectRepository, "standardGetProjects").mockResolvedValue({ items: [EMPTY, LINKED], total: 2 });
        jest.spyOn(sampleRepository, "getProjectStatsSamples").mockImplementation(async (...args: unknown[]) => args[0] === 5 ? SAMPLES : []);
        jest.spyOn(sampleRepository, "getEcoTaxaStats").mockResolvedValue(STORED);
    });

    test("throws when the account cannot be used, before reading anything", async () => {
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));

        await expect(useCase.execute(current_user, [5])).rejects.toThrow("User cannot be used");
        expect(projectRepository.standardGetProjects).toBeCalledTimes(0);
        expect(sampleRepository.getProjectStatsSamples).toBeCalledTimes(0);
    });

    test("answers nothing for no project, without reading", async () => {
        expect(await useCase.execute(current_user, [])).toEqual([]);
        expect(projectRepository.standardGetProjects).toBeCalledTimes(0);
    });

    test("refuses more projects than a page, before reading", async () => {
        const ids = Array.from({ length: PROJECTS_QC_STATES_MAX + 1 }, (_, i) => i + 1);

        await expect(useCase.execute(current_user, ids)).rejects.toThrow(`Too many projects, at most ${PROJECTS_QC_STATES_MAX}`);
        expect(projectRepository.standardGetProjects).toBeCalledTimes(0);
    });

    test("answers in the order asked, duplicates removed, unknown projects left out", async () => {
        const states = await useCase.execute(current_user, [5, 99, 6, 5]);

        expect(userRepository.ensureUserCanBeUsed).toBeCalledWith(7);
        expect(projectRepository.standardGetProjects).toBeCalledWith({ filter: [{ field: "project_id", operator: "IN", value: [5, 99, 6] }], sort_by: [], page: 1, limit: 3 });
        expect(sampleRepository.getProjectStatsSamples).toBeCalledTimes(2);
        expect(sampleRepository.getEcoTaxaStats).toBeCalledWith([1]);
        expect(states).toEqual([
            { project_id: 5, qc_state: "warning", warnings: LINKED_WARNINGS },
            { project_id: 6, qc_state: "empty", warnings: [] },
        ]);
    });

    test("leaves the raw backup warning out for a user without privilege on the project", async () => {
        jest.spyOn(privilegeRepository, "getProjectsByUser").mockResolvedValue([]);

        const [state] = await useCase.execute(current_user, [5]);

        expect(state.warnings.map(warning => warning.code)).toEqual(["samples_without_ctd", "samples_not_imported_in_ecotaxa"]);
    });

    test("shows the raw backup warning to an admin, without looking up their privileges", async () => {
        jest.spyOn(userRepository, "isAdmin").mockResolvedValue(true);
        jest.spyOn(privilegeRepository, "getProjectsByUser").mockResolvedValue([]);

        const [state] = await useCase.execute(current_user, [5]);

        expect(privilegeRepository.getProjectsByUser).toBeCalledTimes(0);
        expect(state.warnings).toEqual(LINKED_WARNINGS);
    });

    test("gives the warnings the STATS tab shows for the same project", async () => {
        const ecotaxa = new ExploreEcoTaxaService(new MockEcotaxaAccountRepository(), sampleRepository, projectRepository);
        jest.spyOn(ecotaxa, "summaryOf").mockResolvedValue({
            categories: ["Copepoda"],
            classification: { fully_validated: 100, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
            objects: { total: 30, validated: 30, predicted: 0 },
            nb_samples_with_stats: 1,
            partial: false,
            nb_samples_pending: 0,
        });
        jest.spyOn(privilegeRepository, "isManager").mockResolvedValue(false);
        jest.spyOn(privilegeRepository, "isGranted").mockResolvedValue(true);
        jest.spyOn(projectRepository, "getProject").mockResolvedValue(LINKED);
        const taskRepository = new MockTaskRepository();
        jest.spyOn(taskRepository, "countExportTasks").mockResolvedValue(0);
        const stats = await new GetProjectStats(userRepository, projectRepository, privilegeRepository, sampleRepository, taskRepository, ecotaxa, () => NOW).execute(current_user, { project_id: 5 });

        const [state] = await useCase.execute(current_user, [5]);

        expect(state.warnings).toEqual(buildProjectQcWarnings(stats));
    });
});
