import { PublicEcotaxaAccountProjectModel } from "../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ListEcotaxaAccountProjectsUseCase } from "../../interfaces/use-cases/ecotaxa_account/list-ecotaxa_account-projects";

/**
 * The EcoTaxa projects one of the logged user's EcoTaxa accounts can manage, offered when
 * an EcoPart project is linked to an existing EcoTaxa project. Only the owner of the account
 * can list them: linking also requires the account to be theirs (ensureUserCanUseEcotaxaAccount).
 * With an instrument model, only the EcoTaxa projects of the matching instrument are listed.
 * Projects already linked to an EcoPart project are flagged: they cannot be linked again.
 */
export class ListEcotaxaAccountProjects implements ListEcotaxaAccountProjectsUseCase {
    userRepository: UserRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository
    projectRepository: ProjectRepository

    constructor(userRepository: UserRepository, ecotaxaAccountRepository: EcotaxaAccountRepository, projectRepository: ProjectRepository) {
        this.userRepository = userRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, ecopart_user_id: number, ecotaxa_account_id: number, instrument_model?: string): Promise<PublicEcotaxaAccountProjectModel[]> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        if (current_user.user_id !== ecopart_user_id) {
            throw new Error("User cannot list the projects of this ecotaxa account");
        }

        const ecotaxa_account = await this.ecotaxaAccountRepository.getOneEcotaxaAccount(ecotaxa_account_id, ecopart_user_id);
        if (!ecotaxa_account) {
            throw new Error("Ecotaxa account not found");
        }
        if (new Date(ecotaxa_account.ecotaxa_account_expiration_utc_date_time) < new Date()) {
            throw new Error("Ecotaxa account session expired");
        }

        const [ecotaxa_projects, linked_ids] = await Promise.all([
            this.ecotaxaAccountRepository.listManageableEcotaxaProjects(ecotaxa_account, instrument_model).catch((err: Error) => {
                // EcoTaxa no longer accepts the stored token (revoked, or expired earlier than recorded).
                if (/^HTTP 40[13]\b/.test(err.message)) throw new Error("Ecotaxa account session expired");
                throw err;
            }),
            this.projectRepository.getLinkedEcotaxaProjectIds(ecotaxa_account.ecotaxa_account_instance_id),
        ]);

        return ecotaxa_projects
            .map((project) => ({
                ecotaxa_project_id: project.projid,
                ecotaxa_project_title: project.title,
                ecotaxa_project_instrument: project.instrument,
                ecotaxa_project_object_count: project.objcount,
                ecotaxa_project_validated_pct: project.pctvalidated,
                already_linked: linked_ids.has(project.projid),
            }))
            // Most recent EcoTaxa projects first (EcoTaxa ids grow with time).
            .sort((a, b) => b.ecotaxa_project_id - a.ecotaxa_project_id);
    }
}
