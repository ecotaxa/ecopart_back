import { ExploreEcoTaxaSummary, ExploreImage, ExploreSampleRow } from "../../../../src/domain/entities/explore";
import { ExploreEcoTaxaService, EXPLORE_IMAGES_DEFAULT } from "../../../../src/domain/use-cases/explore/explore-ecotaxa";
import { ExploreSelectionRepositories, toSampleQuery } from "../../../../src/domain/use-cases/explore/explore-selection";
import { GetExploreEcoTaxa } from "../../../../src/domain/use-cases/explore/get-explore-ecotaxa";
import { GetExploreImages } from "../../../../src/domain/use-cases/explore/get-explore-images";
import { GetExploreMap } from "../../../../src/domain/use-cases/explore/get-explore-map";
import { GetExploreSelection } from "../../../../src/domain/use-cases/explore/get-explore-selection";
import { ListExploreProjects } from "../../../../src/domain/use-cases/explore/list-explore-projects";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { ALICE, BOB, CAROL, exploreFilters, exploreProject, exploreSample, privileges } from "./explore-fixtures";

// Alice manages the private project, Bob is a member of the open one, Carol has no privilege.
const OPEN = exploreProject(1, "open", { project_title: "Ligurian profiles", instrument_model: "UVP6LP" });
const PRIVATE = exploreProject(2, "private", { project_title: "Arctic moorings", instrument_model: "UVP5HD" });
const PUBLIC_TWIN = exploreProject(5, "public", { project_title: "Arctic moorings", instrument_model: "UVP5SD" });

const SAMPLES: ExploreSampleRow[] = [
    exploreSample({ sample_id: 1, sample_name: "moose_001", project_id: 1, latitude: 43.4, longitude: 7.87 }),
    exploreSample({ sample_id: 2, sample_name: "moose_002", project_id: 1, visual_qc_status_label: "PENDING", latitude: null }),
    exploreSample({ sample_id: 3, sample_name: "arctic_003", project_id: 2, latitude: 78.9, longitude: -0.5 }),
];

describe("Explore use cases", () => {
    let userRepository: MockUserRepository;
    let projectRepository: MockProjectRepository;
    let privilegeRepository: MockPrivilegeRepository;
    let sampleRepository: MockSampleRepository;
    let repositories: ExploreSelectionRepositories;
    let ecotaxa: ExploreEcoTaxaService;

    beforeEach(() => {
        jest.clearAllMocks();
        userRepository = new MockUserRepository();
        projectRepository = new MockProjectRepository();
        privilegeRepository = new MockPrivilegeRepository();
        sampleRepository = new MockSampleRepository();
        repositories = { userRepository, projectRepository, privilegeRepository, sampleRepository };
        ecotaxa = new ExploreEcoTaxaService(new MockEcotaxaAccountRepository(), sampleRepository, projectRepository);
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(userRepository, "isAdmin").mockResolvedValue(false);
        jest.spyOn(projectRepository, "listProjects").mockResolvedValue([OPEN, PRIVATE, PUBLIC_TWIN]);
        jest.spyOn(privilegeRepository, "getPublicPrivilegesOfProjects").mockResolvedValue(new Map([
            [1, privileges(1, [ALICE], [BOB])],
            [2, privileges(2, [ALICE])],
        ]));
        jest.spyOn(sampleRepository, "countSamplesPerProject").mockResolvedValue(new Map([[1, 30], [2, 4]]));
        jest.spyOn(sampleRepository, "getExploreSamples").mockResolvedValue(SAMPLES);
    });

    describe("ListExploreProjects", () => {
        test("lists every project to anyone, sorted by title then id, with its number of samples", async () => {
            const options = await new ListExploreProjects(repositories).execute(null);

            expect(options).toEqual([
                { project_id: 2, project_title: "Arctic moorings", nb_samples: 4 },
                { project_id: 5, project_title: "Arctic moorings", nb_samples: 0 },
                { project_id: 1, project_title: "Ligurian profiles", nb_samples: 30 },
            ]);
            expect(userRepository.ensureUserCanBeUsed).toBeCalledTimes(0);
            expect(sampleRepository.countSamplesPerProject).toBeCalledWith([1, 2, 5]);
        });

        test("a logged user is checked first", async () => {
            await new ListExploreProjects(repositories).execute({ user_id: CAROL.user_id });
            expect(userRepository.ensureUserCanBeUsed).toBeCalledWith(CAROL.user_id);

            jest.spyOn(userRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            await expect(new ListExploreProjects(repositories).execute({ user_id: CAROL.user_id })).rejects.toThrow("User cannot be used");
        });
    });

    describe("GetExploreMap", () => {
        test("one point per located sample of the selection, private projects included", async () => {
            const filters = exploreFilters({ months: [6], sample_names: ["moose", "arctic"] });

            const points = await new GetExploreMap(repositories, ecotaxa).execute(null, { mode: "depth", filters });

            expect(sampleRepository.getExploreSamples).toBeCalledWith(toSampleQuery("depth", filters, null));
            expect(points).toEqual([
                { sample_id: 1, sample_name: "moose_001", project_id: 1, project_title: "Ligurian profiles", latitude: 43.4, longitude: 7.87, instrument_model: "UVP6LP", privacy_status: "open", is_my_project: false },
                { sample_id: 3, sample_name: "arctic_003", project_id: 2, project_title: "Arctic moorings", latitude: 78.9, longitude: -0.5, instrument_model: "UVP5HD", privacy_status: "private", is_my_project: false },
            ]);
        });

        test("'my project' is flagged for a member", async () => {
            const points = await new GetExploreMap(repositories, ecotaxa).execute({ user_id: BOB.user_id }, { mode: "depth", filters: null });

            expect(points.map(point => [point.sample_id, point.is_my_project])).toEqual([[1, true], [3, false]]);
        });

        test("a classification state is decided with EcoTaxa", async () => {
            jest.spyOn(ecotaxa, "filterByClassificationState").mockResolvedValue([SAMPLES[2]]);
            const filters = exploreFilters({ classification_state: "fully_predicted" });

            const points = await new GetExploreMap(repositories, ecotaxa).execute(null, { mode: "time", filters });

            expect(ecotaxa.filterByClassificationState).toBeCalledWith(SAMPLES, expect.any(Map), filters);
            expect(points.map(point => point.sample_id)).toEqual([3]);
            expect(sampleRepository.getExploreSamples).toBeCalledWith(expect.objectContaining({ sample_type_label: "Time" }));
        });
    });

    describe("GetExploreSelection", () => {
        test("all the matching samples, and those the user may export", async () => {
            const response = await new GetExploreSelection(repositories, ecotaxa).execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

            expect(response.all.summary?.counts).toEqual({ projects: 2, samples: 3, particles: 3 * 345678, images: 3 * 1200 });
            expect(response.all.projects.map(row => [row.project_id, row.nb_selected_samples, row.nb_samples])).toEqual([[2, 1, 4], [1, 2, 30]]);
            // Carol may export the open project only, and sample 2 is not validated.
            expect(response.exportable.summary?.counts.samples).toBe(1);
            expect(response.exportable.projects.map(row => row.project_id)).toEqual([1]);
            expect(response.all.projects[1].contact).toEqual({ user_name: ALICE.user_name, email: ALICE.email });
        });

        test("an anonymous caller sees the stats, no exportable sample and no e-mail", async () => {
            const response = await new GetExploreSelection(repositories, ecotaxa).execute(null, { mode: "depth", filters: null });

            expect(response.all.summary?.counts.samples).toBe(3);
            expect(response.exportable).toEqual({ summary: null, projects: [] });
            for (const row of response.all.projects) {
                expect(row.contact?.email).toBe("");
                expect(row.managers.every(manager => manager.email === "")).toBe(true);
            }
        });

        test("a manager may export the validated samples of the private project", async () => {
            const response = await new GetExploreSelection(repositories, ecotaxa).execute({ user_id: ALICE.user_id }, { mode: "depth", filters: null });

            expect(response.exportable.projects.map(row => row.project_id)).toEqual([2, 1]);
            expect(response.exportable.summary?.counts.samples).toBe(2);
        });
    });

    describe("GetExploreEcoTaxa", () => {
        const summary = (nb: number, nb_samples_pending = 0): ExploreEcoTaxaSummary => ({
            categories: ["Copepoda"],
            classification: { fully_validated: 100, fully_predicted: 0, partially_validated: 0, partially_predicted: 0 },
            objects: { total: nb * 10, validated: nb * 10, predicted: 0 },
            nb_samples_with_stats: nb,
            partial: nb_samples_pending > 0,
            nb_samples_pending,
        });

        test("summarises all the samples and the exportable ones", async () => {
            jest.spyOn(ecotaxa, "summaryOf").mockResolvedValueOnce(summary(3)).mockResolvedValueOnce(summary(1));

            const response = await new GetExploreEcoTaxa(repositories, ecotaxa).execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

            expect(response).toEqual({ all: summary(3), exportable: summary(1) });
            expect(ecotaxa.summaryOf).toBeCalledTimes(2);
            expect(ecotaxa.summaryOf).toHaveBeenNthCalledWith(1, SAMPLES, expect.any(Map), false);
            expect(ecotaxa.summaryOf).toHaveBeenNthCalledWith(2, [SAMPLES[0]], expect.any(Map), false);
        });

        test("a summary still being read from EcoTaxa is passed on as partial", async () => {
            jest.spyOn(ecotaxa, "summaryOf").mockResolvedValueOnce(summary(1, 2)).mockResolvedValueOnce(summary(1));

            const response = await new GetExploreEcoTaxa(repositories, ecotaxa).execute({ user_id: CAROL.user_id }, { mode: "depth", filters: null });

            expect(response.all).toMatchObject({ partial: true, nb_samples_pending: 2 });
            expect(response.exportable).toMatchObject({ partial: false, nb_samples_pending: 0 });
        });

        test("passes the 'exclude not living' criterion", async () => {
            jest.spyOn(ecotaxa, "summaryOf").mockResolvedValue(summary(0));

            await new GetExploreEcoTaxa(repositories, ecotaxa).execute(null, { mode: "depth", filters: exploreFilters({ ecotaxa_exclude_not_living: true }) });

            expect(ecotaxa.summaryOf).toHaveBeenNthCalledWith(1, SAMPLES, expect.any(Map), true);
            expect(ecotaxa.summaryOf).toHaveBeenNthCalledWith(2, [], expect.any(Map), true);
        });
    });

    describe("GetExploreImages", () => {
        const images: ExploreImage[] = [{ object_id: 42, image_url: "https://ecotaxa.obs-vlfr.fr/vault/1/42.jpg", sample_name: "moose_001", depth: 12.5, date: "2024-06-12T10:20:30.000Z" }];

        test(`draws ${EXPLORE_IMAGES_DEFAULT} images by default among the matching samples`, async () => {
            jest.spyOn(ecotaxa, "randomImagesOf").mockResolvedValue(images);

            await expect(new GetExploreImages(repositories, ecotaxa).execute(null, { mode: "depth", filters: null })).resolves.toEqual(images);
            expect(ecotaxa.randomImagesOf).toBeCalledWith(SAMPLES, expect.any(Map), EXPLORE_IMAGES_DEFAULT);
        });

        test("draws the asked number of images", async () => {
            jest.spyOn(ecotaxa, "randomImagesOf").mockResolvedValue(images);

            await new GetExploreImages(repositories, ecotaxa).execute(null, { mode: "depth", filters: null, count: 12 });

            expect(ecotaxa.randomImagesOf).toBeCalledWith(SAMPLES, expect.any(Map), 12);
        });

        test.each([0, 13, 2.5])("count %p is refused before anything is read", async (count) => {
            jest.spyOn(ecotaxa, "randomImagesOf").mockResolvedValue(images);

            await expect(new GetExploreImages(repositories, ecotaxa).execute(null, { mode: "depth", filters: null, count })).rejects.toThrow("count must be between 1 and 12");
            expect(projectRepository.listProjects).toBeCalledTimes(0);
            expect(ecotaxa.randomImagesOf).toBeCalledTimes(0);
        });
    });
});
