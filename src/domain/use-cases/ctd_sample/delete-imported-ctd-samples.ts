import { UserUpdateModel } from "../../entities/user";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { PublicSampleModel } from "../../entities/sample";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteImportedCTDSamplesUseCase } from "../../interfaces/use-cases/ctd_sample/delete-imported-ctd-samples";

export class DeleteImportedCTDSamples implements DeleteImportedCTDSamplesUseCase {
    sampleRepository: SampleRepository;
    userRepository: UserRepository;
    privilegeRepository: PrivilegeRepository;
    projectRepository: ProjectRepository;

    constructor(sampleRepository: SampleRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository) {
        this.sampleRepository = sampleRepository;
        this.userRepository = userRepository;
        this.privilegeRepository = privilegeRepository;
        this.projectRepository = projectRepository;
    }

    async execute(current_user: UserUpdateModel, project_id: number, samples_names: string[]): Promise<void> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanDelete(current_user, project_id);

        const project = await this.projectRepository.getProject({ project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }

        const samples = await this.ensureSamplesExistAndAreImported(samples_names, project_id);

        await this.sampleRepository.deleteImportedCTDSamplesFromDb(samples);
    }

    private async ensureSamplesExistAndAreImported(samples_names: string[], project_id: number): Promise<PublicSampleModel[]> {
        const options: PreparedSearchOptions = {
            filter: [
                { field: "sample_name", operator: "IN", value: samples_names },
                { field: "project_id", operator: "=", value: project_id },
            ],
            sort_by: [],
            page: 1,
            limit: samples_names.length,
        };

        const result: SearchResult<PublicSampleModel> = await this.sampleRepository.standardGetSamples(options);

        if (!result || result.total === 0) {
            throw new Error("Cannot find CTD samples to delete");
        }

        const found_names = result.items.map((s) => s.sample_name);
        const missing = samples_names.filter((name) => !found_names.includes(name));
        if (missing.length > 0) {
            throw new Error(`Some CTD samples to delete were not found: ${missing.join(", ")}`);
        }

        const not_imported = result.items.filter((s) => !s.ctd_imported);
        if (not_imported.length > 0) {
            throw new Error(`Some samples do not have an imported CTD file: ${not_imported.map((s) => s.sample_name).join(", ")}`);
        }

        return result.items;
    }

    private async ensureUserCanDelete(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isManager({
            user_id: current_user.user_id,
            project_id: project_id,
        });

        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot delete imported CTD samples in this project");
        }
    }
}
