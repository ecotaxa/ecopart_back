import { ExploreFilters, ExploreMode, ExploreRequest, ExploreSampleQuery, ExploreSampleRow } from "../../entities/explore";
import { ProjectPrivacyLevel, ProjectResponseModel } from "../../entities/project";
import { PublicPrivilege } from "../../entities/privilege";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { isProjectActionAllowed, privacyOf, ProjectRole } from "../project/project-access";

/* The selection behind every Explore request: the user (anonymous or not), every project of the
 * application with what the user may do with it, and the samples matching the criteria. Resolved
 * once per request and shared by the map, the stats, the EcoTaxa summary, the images and the graphs. */

export interface ExploreUser {
    user_id: number | null;                   // null: anonymous
    is_admin: boolean;
}

export interface ExploreProjectContext {
    project: ProjectResponseModel;
    privacy: ProjectPrivacyLevel;
    role: ProjectRole;
    is_my_project: boolean;                   // the user is a member or a manager
    can_export: boolean;                      // export_particles in the access matrix, never for an anonymous
    can_figures: boolean;                     // figures in the access matrix, never for an anonymous
    privileges: PublicPrivilege | null;
    nb_samples: number;                       // every sample of the project, both types
}

export interface ExploreSelectionContext {
    mode: ExploreMode;
    filters: ExploreFilters | null;
    user: ExploreUser;
    projects: Map<number, ExploreProjectContext>;
    samples: ExploreSampleRow[];              // the matching samples, private projects included
    exportable: ExploreSampleRow[];           // those the user may export: project exportable, visual QC validated
}

export interface ExploreSelectionRepositories {
    userRepository: UserRepository;
    projectRepository: ProjectRepository;
    privilegeRepository: PrivilegeRepository;
    sampleRepository: SampleRepository;
}

// Samples whose classification state is asked are decided with EcoTaxa, by the caller.
export type ClassificationStateFilter = (samples: ExploreSampleRow[], projects: Map<number, ExploreProjectContext>, filters: ExploreFilters) => Promise<ExploreSampleRow[]>;

export const SAMPLE_TYPE_OF_MODE: Record<ExploreMode, "Depth" | "Time" | null> = { depth: "Depth", time: "Time", all: null };

export async function resolveExploreUser(userRepository: UserRepository, current_user: UserUpdateModel | null | undefined): Promise<ExploreUser> {
    if (!current_user) return { user_id: null, is_admin: false };
    await userRepository.ensureUserCanBeUsed(current_user.user_id);
    return { user_id: current_user.user_id, is_admin: await userRepository.isAdmin(current_user.user_id) };
}

function roleOf(user: ExploreUser, privileges: PublicPrivilege | null): ProjectRole {
    if (user.is_admin) return "admin";
    if (user.user_id === null || !privileges) return "user";
    if (privileges.managers.some(manager => manager.user_id === user.user_id)) return "manager";
    if (privileges.members.some(member => member.user_id === user.user_id)) return "member";
    return "user";
}

// Every project of the application, with the user's rights on it: three queries, whatever the number of projects.
export async function loadExploreProjects(repositories: ExploreSelectionRepositories, user: ExploreUser, now: Date = new Date()): Promise<Map<number, ExploreProjectContext>> {
    const projects = await repositories.projectRepository.listProjects();
    const project_ids = projects.map(project => project.project_id);
    const [privileges, counts] = await Promise.all([
        repositories.privilegeRepository.getPublicPrivilegesOfProjects(project_ids),
        repositories.sampleRepository.countSamplesPerProject(project_ids),
    ]);
    const contexts = new Map<number, ExploreProjectContext>();
    for (const project of projects) {
        const project_privileges = privileges.get(project.project_id) ?? null;
        const privacy = privacyOf(project, now);
        const role = roleOf(user, project_privileges);
        const logged_in = user.user_id !== null;
        contexts.set(project.project_id, {
            project,
            privacy,
            role,
            is_my_project: role === "manager" || role === "member",
            can_export: logged_in && isProjectActionAllowed(role, privacy, "export_particles"),
            can_figures: logged_in && isProjectActionAllowed(role, privacy, "figures"),
            privileges: project_privileges,
            nb_samples: counts.get(project.project_id) ?? 0,
        });
    }
    return contexts;
}

// The projects the criteria keep: by id, by instrument, by privacy status, "My projects" overriding the status.
export function projectsMatching(projects: Map<number, ExploreProjectContext>, filters: ExploreFilters | null): ExploreProjectContext[] {
    const all = Array.from(projects.values());
    if (!filters) return all;
    const statuses = new Set(filters.privacy_statuses);
    return all.filter(context => {
        if (filters.project_ids.length > 0 && !filters.project_ids.includes(context.project.project_id)) return false;
        if (filters.instrument_models.length > 0 && !filters.instrument_models.includes(context.project.instrument_model)) return false;
        if (statuses.size > 0 && !statuses.has(context.privacy) && !(filters.my_projects && context.is_my_project)) return false;
        return true;
    });
}

export function toSampleQuery(mode: ExploreMode, filters: ExploreFilters | null, project_ids: number[] | null): ExploreSampleQuery {
    return {
        sample_type_label: SAMPLE_TYPE_OF_MODE[mode],
        project_ids,
        bounds: filters?.bounds ?? null,
        date_from: filters?.date_from ?? null,
        date_to: filters?.date_to ?? null,
        months: filters?.months ?? [],
        sample_names: filters?.sample_names ?? [],
        hour_range: filters?.hour_range ?? null,
        pressure_range: filters?.pressure_range ?? null,
        ctd_only: filters?.ctd_only ?? false,
        ecotaxa_imported_only: filters?.ecotaxa_imported_only ?? false,
    };
}

export function isExportable(sample: ExploreSampleRow, projects: Map<number, ExploreProjectContext>): boolean {
    return (projects.get(sample.project_id)?.can_export ?? false) && sample.visual_qc_status_label === "VALIDATED";
}

export async function resolveExploreSelection(
    repositories: ExploreSelectionRepositories,
    current_user: UserUpdateModel | null | undefined,
    request: ExploreRequest,
    classificationStateFilter: ClassificationStateFilter,
    now: Date = new Date(),
): Promise<ExploreSelectionContext> {
    const user = await resolveExploreUser(repositories.userRepository, current_user);
    const projects = await loadExploreProjects(repositories, user, now);
    const kept = projectsMatching(projects, request.filters);
    // No project-level criterion: no IN list of every project id.
    const project_ids = kept.length === projects.size ? null : kept.map(context => context.project.project_id);
    let samples = await repositories.sampleRepository.getExploreSamples(toSampleQuery(request.mode, request.filters, project_ids));
    if (request.filters && request.filters.classification_state !== "all") {
        samples = await classificationStateFilter(samples, projects, request.filters);
    }
    return {
        mode: request.mode,
        filters: request.filters,
        user,
        projects,
        samples,
        exportable: samples.filter(sample => isExportable(sample, projects)),
    };
}
