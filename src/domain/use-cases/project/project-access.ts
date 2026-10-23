import { ProjectPrivacyLevel, ProjectResponseModel, PublicProjectResponseModel } from "../../entities/project";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { computeProjectPrivacy } from "../../utils/project-privacy";

/* Access control on project data, from the functional specification ("Access control on Project
 * data"). What a user may do with a project depends on their role on it and on the project's
 * privacy status. Members and managers bypass the privacy delays; an application admin can do
 * everything; a user without any privilege on the project gets more as the project opens up:
 *
 *   privacy  | see | figures | export_particles | export_ecotaxa
 *   private  |  V  |    X    |        X         |       X
 *   visible  |  V  |    V    |        X         |       X
 *   public   |  V  |    V    |        V         |       X
 *   open     |  V  |    V    |        V         |       V
 *
 * Anonymous users are not served by this API at all: every route needs a login. */

export type ProjectRole = "admin" | "manager" | "member" | "user";

export type ProjectAction =
    | "see"               // project metadata and stats, so that access can be requested
    | "figures"           // sample list, sample details, QC graphs
    | "export_particles"  // binned export (product 1)
    | "export_ecotaxa"    // EcoTaxa classification data
    | "export_archive"    // archive recovery (raw export): the files the members imported
    | "import"            // import samples, CTD and EcoTaxa samples, validate QC, regenerate pivots
    | "manage";           // edit metadata and privileges, backup, delete

export function isProjectActionAllowed(role: ProjectRole, privacy: ProjectPrivacyLevel, action: ProjectAction): boolean {
    if (role === "admin" || role === "manager") return true;
    if (role === "member") return action !== "manage";
    switch (action) {
        case "see": return true;
        case "figures": return privacy !== "private";
        case "export_particles": return privacy === "public" || privacy === "open";
        case "export_ecotaxa": return privacy === "open";
        default: return false;
    }
}

export type ProjectPrivacyInputs = Pick<ProjectResponseModel, "project_id" | "oldest_sample_utc_date_time" | "privacy_duration" | "visible_duration" | "public_duration">;

export function privacyOf(project: ProjectPrivacyInputs, now: Date = new Date()): ProjectPrivacyLevel {
    return computeProjectPrivacy(project.oldest_sample_utc_date_time, project.privacy_duration, project.visible_duration, project.public_duration, now);
}

// What a project looks like from outside: the import folder on the server and the backup date are
// operational details of its members.
export function restrictProjectView(project: PublicProjectResponseModel, role: ProjectRole): PublicProjectResponseModel {
    if (role !== "user") return project;
    const view = { ...project };
    delete view.root_folder_path;
    delete view.last_backup_utc_date_time;
    return view;
}

export class ProjectAccessPolicy {
    constructor(private userRepository: UserRepository, private privilegeRepository: PrivilegeRepository) { }

    async roleOf(user_id: number, project_id: number): Promise<ProjectRole> {
        if (await this.userRepository.isAdmin(user_id)) return "admin";
        if (await this.privilegeRepository.isManager({ user_id, project_id })) return "manager";
        if (await this.privilegeRepository.isGranted({ user_id, project_id })) return "member";
        return "user";
    }

    // Decided with as few lookups as needed: an admin is never asked for privileges, and a project
    // open enough for the action never has its privileges read either.
    async can(user_id: number, project: ProjectPrivacyInputs, action: ProjectAction, now: Date = new Date()): Promise<boolean> {
        if (await this.userRepository.isAdmin(user_id)) return true;
        if (isProjectActionAllowed("user", privacyOf(project, now), action)) return true;
        const privilege = { user_id, project_id: project.project_id };
        if (action === "manage") return this.privilegeRepository.isManager(privilege);
        return this.privilegeRepository.isGranted(privilege);
    }
}
