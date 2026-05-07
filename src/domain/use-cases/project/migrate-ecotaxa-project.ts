import { MigrateEcotaxaProjectRequestModel, MigrateEcotaxaProjectResponseModel, ProjectUpdateModel, PublicProjectResponseModel } from "../../entities/project";
import { SampleUpdateModel } from "../../entities/sample";
import { PreparedSearchOptions } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";

import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { MigrateEcotaxaProjectUseCase } from "../../interfaces/use-cases/project/migrate-ecotaxa-project";

export class MigrateEcotaxaProject implements MigrateEcotaxaProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    sampleRepository: SampleRepository
    privilegeRepository: PrivilegeRepository
    ecotaxa_accountRepository: EcotaxaAccountRepository

    constructor(
        userRepository: UserRepository,
        projectRepository: ProjectRepository,
        sampleRepository: SampleRepository,
        privilegeRepository: PrivilegeRepository,
        ecotaxa_accountRepository: EcotaxaAccountRepository
    ) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.sampleRepository = sampleRepository
        this.privilegeRepository = privilegeRepository
        this.ecotaxa_accountRepository = ecotaxa_accountRepository
    }

    async execute(current_user: UserUpdateModel, project_id: number, migrate_request: MigrateEcotaxaProjectRequestModel): Promise<MigrateEcotaxaProjectResponseModel> {
        // 1. Ensure user is valid and is admin
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) {
            throw new Error("Admin only: only administrators can perform ecotaxa migration");
        }

        // 2. Get the EcoPart project
        const project = await this.projectRepository.getProject({ project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }

        const { ecotaxa_project_id, ecotaxa_instance_id } = migrate_request;

        // 3. Resolve the generic EcoTaxa account for the given instance
        const ecotaxa_instance = await this.ecotaxa_accountRepository.getOneEcoTaxaInstance(ecotaxa_instance_id);
        if (!ecotaxa_instance) {
            throw new Error("Ecotaxa instance not found");
        }
        const generic_account = await this.ecotaxa_accountRepository.getEcotaxaGenericAccountForInstance(ecotaxa_instance_id);

        // 4. Ensure the EcoTaxa project is not already linked to another EcoPart project
        await this.projectRepository.ensureEcotaxaProjectNotLinkedToAnotherEcopartProject(ecotaxa_project_id, ecotaxa_instance_id);

        // 5. Link EcoTaxa project: validates existence, instrument match, and manager rights on EcoTaxa side
        const ecotaxa_values = await this.ecotaxa_accountRepository.linkEcotaxaAndEcopartProject({
            ...project,
            ecotaxa_project_id,
            ecotaxa_instance_id,
            ecotaxa_account_id: generic_account.ecotaxa_account_id,
            new_ecotaxa_project: false,
            members: [],
            managers: [],
            contact: { user_id: current_user.user_id }
        } as any);

        // 6. Update EcoPart project with ecotaxa link
        const project_update: ProjectUpdateModel = {
            project_id,
            ecotaxa_project_id: ecotaxa_values.ecotaxa_project_id,
            ecotaxa_project_name: ecotaxa_values.ecotaxa_project_name,
            ecotaxa_instance_id
        };
        await this.projectRepository.standardUpdateProject(project_update);

        // 7. Get all EcoTaxa samples from the linked EcoTaxa project
        const ecotaxa_samples = await this.ecotaxa_accountRepository.api_ecotaxa_get_samples_in_project(
            ecotaxa_instance.ecotaxa_instance_url,
            generic_account.ecotaxa_account_token,
            ecotaxa_values.ecotaxa_project_id
        );

        // 9. Get all EcoPart samples in the project not yet marked as imported
        const search_options: PreparedSearchOptions = {
            filter: [
                { field: "project_id", operator: "=", value: project_id },
                { field: "ecotaxa_sample_imported", operator: "=", value: false }
            ],
            sort_by: [],
            page: 1,
            limit: 999999
        };
        const ecopart_samples = await this.sampleRepository.standardGetSamples(search_options);

        // 10. Match EcoPart samples to EcoTaxa samples by name (orig_id)
        const ecotaxa_sample_map = new Map(ecotaxa_samples.map(s => [s.orig_id, s.sampleid]));
        const to_mark_imported: SampleUpdateModel[] = [];
        const unmatched_samples: string[] = [];

        for (const ecopart_sample of ecopart_samples.items) {
            const ecotaxa_sample_id = ecotaxa_sample_map.get(ecopart_sample.sample_name);
            if (ecotaxa_sample_id !== undefined) {
                to_mark_imported.push({
                    sample_id: ecopart_sample.sample_id,
                    ecotaxa_sample_imported: true,
                    ecotaxa_sample_import_date: new Date().toISOString(),
                    ecotaxa_sample_id
                });
            } else {
                unmatched_samples.push(ecopart_sample.sample_name);
            }
        }

        // 11. Mark matched samples as imported
        if (to_mark_imported.length > 0) {
            await this.sampleRepository.createManyEcoTaxaSamples(to_mark_imported);
        }

        // 12. Build and return response
        const updated_project = await this.projectRepository.getProject({ project_id });
        if (!updated_project) {
            throw new Error("Cannot find updated project");
        }
        const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id });
        if (!privileges) {
            throw new Error("Cannot find project privileges");
        }
        const public_project: PublicProjectResponseModel = this.projectRepository.toPublicProject(updated_project, privileges);

        return {
            project: public_project,
            matched_samples: to_mark_imported.length,
            unmatched_samples
        };
    }
}
