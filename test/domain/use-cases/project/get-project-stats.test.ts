import { ProjectResponseModel } from "../../../../src/domain/entities/project";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { ExploreEcoTaxaService } from "../../../../src/domain/use-cases/explore/explore-ecotaxa";
import { LandMask } from "../../../../src/domain/interfaces/geography/land-mask";
import { GetProjectStats } from "../../../../src/domain/use-cases/project/get-project-stats";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { exploreProject, projectStatsSample } from "../explore/explore-fixtures";

const NOW = new Date("2026-10-23T12:00:00Z");
const current_user: UserUpdateModel = { user_id: 7 };
// Every position at sea except the second sample's, inland.
const LAND: LandMask = { isOnLand: (latitude, longitude) => Math.abs(latitude - 45.76) < 1 && Math.abs(longitude - 4.83) < 1 };

const PROJECT: ProjectResponseModel = exploreProject(5, "open", {
    oldest_sample_utc_date_time: "2021-05-05T10:00:00Z",
    privacy_duration: 2, visible_duration: 22, public_duration: 12,
    last_backup_utc_date_time: "2024-07-10T00:00:00.000Z",
    ecotaxa_project_id: 1234, ecotaxa_instance_id: 1,
});

const SAMPLES = [
    projectStatsSample({ sample_id: 1, sample_name: "s1", project_id: 5, station_id: "st_1", nb_particles: 1000, nb_vignettes: 50, ecotaxa_sample_imported: true, ecotaxa_sample_id: 9001, ctd_imported: true, ctd_latitude: 43.41, ctd_longitude: 7.88, sample_creation_utc_date_time: "2024-07-01T09:00:00.000Z" }),
    projectStatsSample({ sample_id: 2, sample_name: "s2", project_id: 5, station_id: "st_2", nb_particles: null, nb_vignettes: 30, max_pressure: 1500, sample_creation_utc_date_time: "2024-07-11T09:00:00.000Z", latitude: 45.76, longitude: 4.83, sample_latitude: 45.76, sample_longitude: 4.83 }),
];

const ECOTAXA = {
    categories: ["Copepoda"],
    classification: { fully_validated: 100, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
    objects: { total: 30, validated: 30, predicted: 0 },
    nb_samples_with_stats: 1,
    partial: false,
    nb_samples_pending: 0,
};

describe("GetProjectStats use case", () => {
    let userRepository: MockUserRepository;
    let projectRepository: MockProjectRepository;
    let privilegeRepository: MockPrivilegeRepository;
    let sampleRepository: MockSampleRepository;
    let taskRepository: MockTaskRepository;
    let ecotaxa: ExploreEcoTaxaService;
    let useCase: GetProjectStats;

    beforeEach(() => {
        jest.clearAllMocks();
        userRepository = new MockUserRepository();
        projectRepository = new MockProjectRepository();
        privilegeRepository = new MockPrivilegeRepository();
        sampleRepository = new MockSampleRepository();
        taskRepository = new MockTaskRepository();
        ecotaxa = new ExploreEcoTaxaService(new MockEcotaxaAccountRepository(), sampleRepository, projectRepository);
        useCase = new GetProjectStats(userRepository, projectRepository, privilegeRepository, sampleRepository, taskRepository, ecotaxa, LAND, () => NOW);

        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(userRepository, "isAdmin").mockResolvedValue(false);
        jest.spyOn(privilegeRepository, "isManager").mockResolvedValue(false);
        jest.spyOn(privilegeRepository, "isGranted").mockResolvedValue(true);
        jest.spyOn(projectRepository, "getProject").mockResolvedValue(PROJECT);
        jest.spyOn(sampleRepository, "getProjectStatsSamples").mockResolvedValue(SAMPLES);
        jest.spyOn(taskRepository, "countExportTasks").mockResolvedValue(7);
        jest.spyOn(ecotaxa, "summaryOf").mockResolvedValue(ECOTAXA);
    });

    test("throws when the account cannot be used, before reading anything", async () => {
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));

        await expect(useCase.execute(current_user, { project_id: 5 })).rejects.toThrow("User cannot be used");
        expect(projectRepository.getProject).toBeCalledTimes(0);
        expect(sampleRepository.getProjectStatsSamples).toBeCalledTimes(0);
    });

    test("throws when the project does not exist", async () => {
        jest.spyOn(projectRepository, "getProject").mockResolvedValue(null);

        await expect(useCase.execute(current_user, { project_id: 5 })).rejects.toThrow("Cannot find project");
        expect(sampleRepository.getProjectStatsSamples).toBeCalledTimes(0);
    });

    test("assembles every section for a member of the project", async () => {
        const stats = await useCase.execute(current_user, { project_id: 5 });

        expect(userRepository.ensureUserCanBeUsed).toBeCalledWith(7);
        expect(projectRepository.getProject).toBeCalledWith({ project_id: 5 });
        expect(sampleRepository.getProjectStatsSamples).toBeCalledWith(5);
        expect(taskRepository.countExportTasks).toBeCalledWith(5);
        expect(ecotaxa.summaryOf).toBeCalledWith(SAMPLES, expect.any(Map), false);
        const contexts = (ecotaxa.summaryOf as jest.Mock).mock.calls[0][1] as Map<number, { role: string; privacy: string; nb_samples: number }>;
        expect(contexts.get(5)).toMatchObject({ role: "member", privacy: "open", nb_samples: 2 });

        expect(stats).toEqual({
            project_id: 5,
            generated_at: "2026-10-23T12:00:00.000Z",
            counts: { stations: 2, samples: 2, particles: 1000, vignettes: 80, exports: 7 },
            privacy: {
                status: "open",
                oldest_sample_utc_date_time: "2021-05-05T10:00:00Z",
                visible_utc_date_time: "2021-07-05T00:00:00.000Z",
                public_utc_date_time: "2023-05-05T00:00:00.000Z",
                open_utc_date_time: "2024-05-05T00:00:00.000Z",
            },
            raw_backup: { last_backup_utc_date_time: "2024-07-10T00:00:00.000Z", nb_samples_not_backed_up: 1 },
            map: {
                samples: [
                    { sample_id: 1, sample_name: "s1", latitude: 43.4, longitude: 7.87, ctd_latitude: 43.41, ctd_longitude: 7.88, use_ctd_coordinates: false, coordinates_mismatch: false, on_land: false },
                    { sample_id: 2, sample_name: "s2", latitude: 45.76, longitude: 4.83, ctd_latitude: null, ctd_longitude: null, use_ctd_coordinates: false, coordinates_mismatch: false, on_land: true },
                ],
                nb_samples_without_ctd: 1,
                nb_coordinates_mismatches: 0,
                nb_samples_on_land: 1,
            },
            samples: {
                sample_types: { depth: 2, time: 0, total: 2 },
                pressure_range: { min: 0, max: 1500 },
                size_range: expect.objectContaining({ min: expect.any(Number), max: expect.any(Number) }),
                time_range: { start: "2024-06-12T10:20:00.000Z", end: "2024-06-12T10:20:00.000Z" },
                max_pressure_histogram: expect.arrayContaining([{ max_pressure: 600, nb_profiles: 1 }, { max_pressure: 1600, nb_profiles: 1 }]),
                nb_instrument_parameter_mismatches: 0,
                nb_object_size_mismatches: 0,
                nb_suspicious_dates: 0,
                time_span_over_a_year: false,
                nb_suspicious_pressures: 0,
                unfiltered_uvp5hd: false,
            },
            ecotaxa: {
                linked: true,
                ...ECOTAXA,
                nb_samples_not_imported: 1,
                classification_completed: true,
            },
        });
    });

    test("hides the raw backup from a user without privilege on the project", async () => {
        jest.spyOn(privilegeRepository, "isGranted").mockResolvedValue(false);

        const stats = await useCase.execute(current_user, { project_id: 5 });

        expect(stats.raw_backup).toBeNull();
        expect(stats.counts.samples).toBe(2);
    });

    test("an admin gets the raw backup without any privilege lookup", async () => {
        jest.spyOn(userRepository, "isAdmin").mockResolvedValue(true);

        const stats = await useCase.execute(current_user, { project_id: 5 });

        expect(stats.raw_backup).toEqual({ last_backup_utc_date_time: "2024-07-10T00:00:00.000Z", nb_samples_not_backed_up: 1 });
        expect(privilegeRepository.isGranted).toBeCalledTimes(0);
    });

    test("a project without EcoTaxa link never asks EcoTaxa", async () => {
        jest.spyOn(projectRepository, "getProject").mockResolvedValue({ ...PROJECT, ecotaxa_project_id: null, ecotaxa_instance_id: null });

        const stats = await useCase.execute(current_user, { project_id: 5 });

        expect(ecotaxa.summaryOf).toBeCalledTimes(0);
        expect(stats.ecotaxa).toEqual({
            linked: false,
            categories: [],
            classification: { fully_validated: 0, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
            objects: { total: 0, validated: 0, predicted: 0 },
            nb_samples_with_stats: 0,
            partial: false,
            nb_samples_pending: 0,
            nb_samples_not_imported: 1,
            classification_completed: false,
        });
    });

    test("a project without any sample: zero counts, no range, private", async () => {
        jest.spyOn(projectRepository, "getProject").mockResolvedValue({ ...PROJECT, oldest_sample_utc_date_time: null, last_backup_utc_date_time: null });
        jest.spyOn(sampleRepository, "getProjectStatsSamples").mockResolvedValue([]);
        jest.spyOn(taskRepository, "countExportTasks").mockResolvedValue(0);

        const stats = await useCase.execute(current_user, { project_id: 5 });

        expect(stats.counts).toEqual({ stations: 0, samples: 0, particles: 0, vignettes: 0, exports: 0 });
        expect(stats.privacy).toEqual({ status: "private", oldest_sample_utc_date_time: null, visible_utc_date_time: null, public_utc_date_time: null, open_utc_date_time: null });
        expect(stats.raw_backup).toEqual({ last_backup_utc_date_time: null, nb_samples_not_backed_up: 0 });
        expect(stats.map).toEqual({ samples: [], nb_samples_without_ctd: 0, nb_coordinates_mismatches: 0, nb_samples_on_land: 0 });
        expect(stats.samples.sample_types).toEqual({ depth: 0, time: 0, total: 0 });
        expect(stats.samples.pressure_range).toBeNull();
        expect(stats.samples.max_pressure_histogram).toEqual([]);
    });
});
