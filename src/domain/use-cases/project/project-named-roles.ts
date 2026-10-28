import { ProjectResponseModel } from "../../entities/project";
import { UserResponseModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";

/* A project names its data owner, operator and chief scientist by email. A validated account
 * with one of these emails is granted a role on the project without anyone having to add it:
 * data owner or chief scientist → manager, operator → member (manager wins when both apply).
 * A privilege the user already has on the project is left as is, so a role set by hand is never
 * changed. Granting is best effort: a failure is logged, never thrown. */

export type NamedRoleField = "data_owner_email" | "operator_email" | "chief_scientist_email";
export const NAMED_ROLE_FIELDS: NamedRoleField[] = ["data_owner_email", "operator_email", "chief_scientist_email"];

type NamedEmails = Pick<ProjectResponseModel, NamedRoleField>;

export function normalizeNamedEmail(email: string | null | undefined): string {
    return (email ?? "").trim().toLowerCase();
}

export function namedRoleOf(project: NamedEmails, email: string): "manager" | "member" | null {
    const normalized = normalizeNamedEmail(email);
    if (!normalized) return null;
    if (normalizeNamedEmail(project.data_owner_email) === normalized || normalizeNamedEmail(project.chief_scientist_email) === normalized) return "manager";
    if (normalizeNamedEmail(project.operator_email) === normalized) return "member";
    return null;
}

export class ProjectNamedRoles {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly projectRepository: ProjectRepository,
        private readonly privilegeRepository: PrivilegeRepository
    ) { }

    // Users whose email is proven join every project naming it (the projects are read once).
    async joinProjectsNaming(users: Pick<UserResponseModel, "user_id" | "email">[]): Promise<void> {
        if (users.length === 0) return;
        try {
            const projects = await this.projectRepository.listProjects();
            for (const user of users) {
                for (const project of projects) {
                    const role = namedRoleOf(project, user.email);
                    if (role) await this.grantIfAbsent(user.user_id, project.project_id, role);
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    // The validated users named by the given fields of a project join it. Returns how many joined.
    async grantNamedUsers(project: ProjectResponseModel, fields: NamedRoleField[] = NAMED_ROLE_FIELDS): Promise<number> {
        let granted = 0;
        const emails = new Set(fields.map(field => normalizeNamedEmail(project[field])).filter(email => email));
        for (const email of emails) {
            try {
                const user = await this.userRepository.getUser({ email });
                if (!user || !user.valid_email || user.deleted) continue;
                const role = namedRoleOf(project, email);
                if (role && await this.grantIfAbsent(user.user_id, project.project_id, role)) granted += 1;
            } catch (error) {
                console.error(error);
            }
        }
        return granted;
    }

    private async grantIfAbsent(user_id: number, project_id: number, privilege_name: "manager" | "member"): Promise<boolean> {
        try {
            if (await this.privilegeRepository.isGranted({ user_id, project_id })) return false;
            await this.privilegeRepository.addPrivilege({ user_id, project_id, privilege_name, contact: false });
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }
}
