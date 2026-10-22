import { ExploreSampleRow } from "../../../../src/domain/entities/explore";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import {
    ExploreProjectContext,
    ExploreSelectionRepositories,
    isExportable,
    loadExploreProjects,
    projectsMatching,
    resolveExploreSelection,
    resolveExploreUser,
    SAMPLE_TYPE_OF_MODE,
    toSampleQuery,
} from "../../../../src/domain/use-cases/explore/explore-selection";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { ALICE, BOB, CAROL, contextsOf, exploreContext, exploreFilters, exploreProject, exploreSample, privileges, user } from "./explore-fixtures";

const DAN = user(14, "Dan Leroy");
const ADMIN_ID = 1;

// Four projects, one per privacy status: Alice manages the open and the private ones, Bob is a
// member of the open one, Carol has no privilege anywhere.
const OPEN = exploreProject(1, "open", { project_title: "Ligurian profiles" });
const PRIVATE = exploreProject(2, "private", { project_title: "Arctic moorings", instrument_model: "UVP5HD" });
const VISIBLE = exploreProject(3, "visible", { project_title: "Tara Pacific" });
const PUBLIC = exploreProject(4, "public", { project_title: "Green Edge", instrument_model: "UVP5SD" });
const PROJECTS = [OPEN, PRIVATE, VISIBLE, PUBLIC];
const PRIVILEGES = new Map([
    [1, privileges(1, [ALICE], [BOB])],
    [2, privileges(2, [ALICE])],
    [3, privileges(3, [DAN])],
    [4, privileges(4, [DAN])],
]);
const COUNTS = new Map([[1, 12], [2, 3], [3, 40]]);

const logged = (user_id: number): UserUpdateModel => ({ user_id });

describe("Explore selection", () => {
    let userRepository: MockUserRepository;
    let projectRepository: MockProjectRepository;
    let privilegeRepository: MockPrivilegeRepository;
    let sampleRepository: MockSampleRepository;
    let repositories: ExploreSelectionRepositories;

    beforeEach(() => {
        jest.clearAllMocks();
        userRepository = new MockUserRepository();
        projectRepository = new MockProjectRepository();
        privilegeRepository = new MockPrivilegeRepository();
        sampleRepository = new MockSampleRepository();
        repositories = { userRepository, projectRepository, privilegeRepository, sampleRepository };
        jest.spyOn(userRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(userRepository, "isAdmin").mockImplementation(async (...args: unknown[]) => args[0] === ADMIN_ID);
        jest.spyOn(projectRepository, "listProjects").mockResolvedValue(PROJECTS);
        jest.spyOn(privilegeRepository, "getPublicPrivilegesOfProjects").mockResolvedValue(PRIVILEGES);
        jest.spyOn(sampleRepository, "countSamplesPerProject").mockResolvedValue(COUNTS);
    });

    describe("resolveExploreUser", () => {
        test.each([null, undefined])("an anonymous caller (%p) is neither checked nor admin", async (current_user) => {
            await expect(resolveExploreUser(userRepository, current_user)).resolves.toEqual({ user_id: null, is_admin: false });
            expect(userRepository.ensureUserCanBeUsed).toBeCalledTimes(0);
            expect(userRepository.isAdmin).toBeCalledTimes(0);
        });

        test("a logged user is checked, then asked whether admin", async () => {
            await expect(resolveExploreUser(userRepository, logged(ADMIN_ID))).resolves.toEqual({ user_id: ADMIN_ID, is_admin: true });
            await expect(resolveExploreUser(userRepository, logged(ALICE.user_id))).resolves.toEqual({ user_id: ALICE.user_id, is_admin: false });
            expect(userRepository.ensureUserCanBeUsed).toBeCalledWith(ADMIN_ID);
            expect(userRepository.ensureUserCanBeUsed).toBeCalledWith(ALICE.user_id);
        });

        test("a user who cannot be used stops the request", async () => {
            jest.spyOn(userRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            await expect(resolveExploreUser(userRepository, logged(CAROL.user_id))).rejects.toThrow("User cannot be used");
            expect(userRepository.isAdmin).toBeCalledTimes(0);
        });
    });

    describe("loadExploreProjects", () => {
        test("reads every project, their privileges and sample counts in three queries", async () => {
            const projects = await loadExploreProjects(repositories, { user_id: ALICE.user_id, is_admin: false });

            expect(Array.from(projects.keys())).toEqual([1, 2, 3, 4]);
            expect(projectRepository.listProjects).toBeCalledTimes(1);
            expect(privilegeRepository.getPublicPrivilegesOfProjects).toBeCalledWith([1, 2, 3, 4]);
            expect(sampleRepository.countSamplesPerProject).toBeCalledWith([1, 2, 3, 4]);
            expect(projects.get(1)?.nb_samples).toBe(12);
            expect(projects.get(4)?.nb_samples).toBe(0);
            expect(projects.get(1)?.privileges).toBe(PRIVILEGES.get(1));
        });

        test("an anonymous user can neither export nor see the figures of any project, open ones included", async () => {
            const projects = await loadExploreProjects(repositories, { user_id: null, is_admin: false });

            for (const context of projects.values()) {
                expect(context.role).toBe("user");
                expect(context.is_my_project).toBe(false);
                expect(context.can_export).toBe(false);
                expect(context.can_figures).toBe(false);
            }
            expect(Array.from(projects.values()).map(context => context.privacy)).toEqual(["open", "private", "visible", "public"]);
        });

        test("a manager or a member has every right on their projects, private ones included", async () => {
            const alice = await loadExploreProjects(repositories, { user_id: ALICE.user_id, is_admin: false });
            expect(alice.get(2)).toMatchObject({ role: "manager", is_my_project: true, can_export: true, can_figures: true });
            expect(alice.get(1)).toMatchObject({ role: "manager", is_my_project: true });

            const bob = await loadExploreProjects(repositories, { user_id: BOB.user_id, is_admin: false });
            expect(bob.get(1)).toMatchObject({ role: "member", is_my_project: true, can_export: true, can_figures: true });
            expect(bob.get(2)).toMatchObject({ role: "user", is_my_project: false, can_export: false, can_figures: false });
        });

        test("a logged user without privilege gets the rights of the privacy status", async () => {
            const carol = await loadExploreProjects(repositories, { user_id: CAROL.user_id, is_admin: false });

            expect(carol.get(2)).toMatchObject({ privacy: "private", can_figures: false, can_export: false });
            expect(carol.get(3)).toMatchObject({ privacy: "visible", can_figures: true, can_export: false });
            expect(carol.get(4)).toMatchObject({ privacy: "public", can_figures: true, can_export: true });
            expect(carol.get(1)).toMatchObject({ privacy: "open", can_figures: true, can_export: true });
        });

        test("an admin may do everything but is not a member of the projects", async () => {
            const admin = await loadExploreProjects(repositories, { user_id: ADMIN_ID, is_admin: true });

            for (const context of admin.values()) {
                expect(context).toMatchObject({ role: "admin", is_my_project: false, can_export: true, can_figures: true });
            }
        });

        test("a project without privileges has none, and the status follows the given date", async () => {
            const recent = exploreProject(5, "open", { project_creation_utc_date_time: "2026-01-15 09:30:00", privacy_duration: 6, visible_duration: 6, public_duration: 6 });
            jest.spyOn(projectRepository, "listProjects").mockResolvedValue([recent]);
            jest.spyOn(privilegeRepository, "getPublicPrivilegesOfProjects").mockResolvedValue(new Map());

            const in_march = await loadExploreProjects(repositories, { user_id: CAROL.user_id, is_admin: false }, new Date("2026-03-01T00:00:00Z"));
            const in_october = await loadExploreProjects(repositories, { user_id: CAROL.user_id, is_admin: false }, new Date("2026-10-22T00:00:00Z"));

            expect(in_march.get(5)).toMatchObject({ privacy: "private", privileges: null, role: "user", can_figures: false });
            expect(in_october.get(5)).toMatchObject({ privacy: "visible", can_figures: true, can_export: false });
        });
    });

    describe("projectsMatching", () => {
        const contexts = contextsOf(
            exploreContext(OPEN, { privacy: "open", is_my_project: true }),
            exploreContext(PRIVATE, { privacy: "private", is_my_project: true }),
            exploreContext(VISIBLE, { privacy: "visible" }),
            exploreContext(PUBLIC, { privacy: "public" }),
        );
        const ids = (kept: ExploreProjectContext[]) => kept.map(context => context.project.project_id);

        test("no filters, or empty criteria, keep every project", () => {
            expect(ids(projectsMatching(contexts, null))).toEqual([1, 2, 3, 4]);
            expect(ids(projectsMatching(contexts, exploreFilters()))).toEqual([1, 2, 3, 4]);
            expect(ids(projectsMatching(contexts, exploreFilters({ my_projects: true })))).toEqual([1, 2, 3, 4]);
        });

        test("privacy statuses restrict to the checked ones", () => {
            expect(ids(projectsMatching(contexts, exploreFilters({ privacy_statuses: ["public", "open"] })))).toEqual([1, 4]);
            expect(ids(projectsMatching(contexts, exploreFilters({ privacy_statuses: ["private"] })))).toEqual([2]);
        });

        test("'My projects' keeps a private project of mine even when 'private' is unchecked", () => {
            expect(ids(projectsMatching(contexts, exploreFilters({ privacy_statuses: ["visible"], my_projects: true })))).toEqual([1, 2, 3]);
            expect(ids(projectsMatching(contexts, exploreFilters({ privacy_statuses: ["visible"], my_projects: false })))).toEqual([3]);
        });

        test("project ids and instrument models restrict, combined with the other criteria", () => {
            expect(ids(projectsMatching(contexts, exploreFilters({ project_ids: [2, 3] })))).toEqual([2, 3]);
            expect(ids(projectsMatching(contexts, exploreFilters({ instrument_models: ["UVP5HD", "UVP5SD"] })))).toEqual([2, 4]);
            expect(ids(projectsMatching(contexts, exploreFilters({ instrument_models: ["UVP6LP"], privacy_statuses: ["open"] })))).toEqual([1]);
            expect(ids(projectsMatching(contexts, exploreFilters({ project_ids: [2], privacy_statuses: ["open"], my_projects: false })))).toEqual([]);
        });
    });

    describe("toSampleQuery", () => {
        test("maps the mode to the sample type label", () => {
            expect(SAMPLE_TYPE_OF_MODE).toEqual({ depth: "Depth", time: "Time" });
            expect(toSampleQuery("depth", null, null).sample_type_label).toBe("Depth");
            expect(toSampleQuery("time", null, null).sample_type_label).toBe("Time");
        });

        test("no filters means no constraint", () => {
            expect(toSampleQuery("depth", null, null)).toEqual({
                sample_type_label: "Depth", project_ids: null, bounds: null, date_from: null, date_to: null, months: [], sample_names: [],
                hour_range: null, pressure_range: null, ctd_only: false, ecotaxa_imported_only: false,
            });
        });

        test("passes the sample criteria and the project ids through", () => {
            const filters = exploreFilters({
                bounds: { north: 45, south: 40, east: 10, west: 3 }, date_from: "2024-01-01", date_to: "2024-12-31", months: [6, 7],
                sample_names: ["moose"], hour_range: [22, 3], pressure_range: [100, 500], ctd_only: true, ecotaxa_imported_only: true,
            });
            expect(toSampleQuery("time", filters, [1, 4])).toEqual({
                sample_type_label: "Time", project_ids: [1, 4], bounds: { north: 45, south: 40, east: 10, west: 3 }, date_from: "2024-01-01", date_to: "2024-12-31",
                months: [6, 7], sample_names: ["moose"], hour_range: [22, 3], pressure_range: [100, 500], ctd_only: true, ecotaxa_imported_only: true,
            });
        });
    });

    describe("isExportable", () => {
        const contexts = contextsOf(exploreContext(OPEN, { can_export: true }), exploreContext(PRIVATE, { can_export: false }));

        test("needs an exportable project and a validated visual QC", () => {
            expect(isExportable(exploreSample({ project_id: 1 }), contexts)).toBe(true);
            expect(isExportable(exploreSample({ project_id: 1, visual_qc_status_label: "PENDING" }), contexts)).toBe(false);
            expect(isExportable(exploreSample({ project_id: 1, visual_qc_status_label: "REJECTED" }), contexts)).toBe(false);
            expect(isExportable(exploreSample({ project_id: 2 }), contexts)).toBe(false);
            expect(isExportable(exploreSample({ project_id: 99 }), contexts)).toBe(false);
        });
    });

    describe("resolveExploreSelection", () => {
        const samples: ExploreSampleRow[] = [
            exploreSample({ sample_id: 1, project_id: 1 }),
            exploreSample({ sample_id: 2, project_id: 1, visual_qc_status_label: "PENDING" }),
            exploreSample({ sample_id: 3, project_id: 2 }),
            exploreSample({ sample_id: 4, project_id: 3 }),
            exploreSample({ sample_id: 5, project_id: 4 }),
        ];
        let classificationStateFilter: jest.Mock;

        beforeEach(() => {
            jest.spyOn(sampleRepository, "getExploreSamples").mockResolvedValue(samples);
            classificationStateFilter = jest.fn(async (rows: ExploreSampleRow[]) => rows.filter(sample => sample.sample_id !== 4));
        });

        test("no project criterion: no list of project ids is sent to the data source", async () => {
            const selection = await resolveExploreSelection(repositories, logged(CAROL.user_id), { mode: "depth", filters: exploreFilters() }, classificationStateFilter);

            expect(sampleRepository.getExploreSamples).toBeCalledWith(expect.objectContaining({ sample_type_label: "Depth", project_ids: null }));
            expect(selection.samples).toEqual(samples);
            expect(selection.mode).toBe("depth");
            expect(selection.user).toEqual({ user_id: CAROL.user_id, is_admin: false });
        });

        test("a project criterion sends the kept ids, the time mode asks time series", async () => {
            await resolveExploreSelection(repositories, logged(CAROL.user_id), { mode: "time", filters: exploreFilters({ privacy_statuses: ["public", "open"] }) }, classificationStateFilter);

            expect(sampleRepository.getExploreSamples).toBeCalledWith(expect.objectContaining({ sample_type_label: "Time", project_ids: [1, 4] }));
        });

        test("null filters: every sample of the type, no classification filter", async () => {
            await resolveExploreSelection(repositories, null, { mode: "depth", filters: null }, classificationStateFilter);

            expect(sampleRepository.getExploreSamples).toBeCalledWith(toSampleQuery("depth", null, null));
            expect(classificationStateFilter).toBeCalledTimes(0);
        });

        test("the classification-state filter is only called when a state is asked", async () => {
            const all = await resolveExploreSelection(repositories, logged(CAROL.user_id), { mode: "depth", filters: exploreFilters({ classification_state: "all" }) }, classificationStateFilter);
            expect(classificationStateFilter).toBeCalledTimes(0);
            expect(all.samples).toHaveLength(5);

            const filters = exploreFilters({ classification_state: "fully_validated" });
            const validated = await resolveExploreSelection(repositories, logged(CAROL.user_id), { mode: "depth", filters }, classificationStateFilter);
            expect(classificationStateFilter).toBeCalledTimes(1);
            expect(classificationStateFilter).toBeCalledWith(samples, validated.projects, filters);
            expect(validated.samples.map(sample => sample.sample_id)).toEqual([1, 2, 3, 5]);
        });

        test("exportable: validated samples of the projects the user may export", async () => {
            const carol = await resolveExploreSelection(repositories, logged(CAROL.user_id), { mode: "depth", filters: null }, classificationStateFilter);
            // Open (1) and public (4) projects; sample 2 is not validated, 3 is private, 4 only visible.
            expect(carol.exportable.map(sample => sample.sample_id)).toEqual([1, 5]);

            const alice = await resolveExploreSelection(repositories, logged(ALICE.user_id), { mode: "depth", filters: null }, classificationStateFilter);
            expect(alice.exportable.map(sample => sample.sample_id)).toEqual([1, 3, 5]);
        });

        test("an anonymous caller sees every matching sample but can export none", async () => {
            const selection = await resolveExploreSelection(repositories, null, { mode: "depth", filters: null }, classificationStateFilter);

            expect(selection.user).toEqual({ user_id: null, is_admin: false });
            expect(selection.samples).toHaveLength(5);
            expect(selection.exportable).toEqual([]);
            expect(userRepository.ensureUserCanBeUsed).toBeCalledTimes(0);
        });

        test("a user who cannot be used gets no sample", async () => {
            jest.spyOn(userRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));

            await expect(resolveExploreSelection(repositories, logged(CAROL.user_id), { mode: "depth", filters: null }, classificationStateFilter)).rejects.toThrow("User cannot be used");
            expect(projectRepository.listProjects).toBeCalledTimes(0);
            expect(sampleRepository.getExploreSamples).toBeCalledTimes(0);
        });
    });
});
