import { UserUpdateModel } from "../../entities/user";
import { PublicSampleModel } from "../../entities/sample";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ListImportedCTDSamplesUseCase } from "../../interfaces/use-cases/ctd_sample/list-imported-ctd-samples";

export class ListImportedCTDSamples implements ListImportedCTDSamplesUseCase {
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

    async execute(current_user: UserUpdateModel, project_id: number): Promise<SearchResult<PublicSampleModel>> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);

        const project = await this.projectRepository.getProject({ project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }

        const options: PreparedSearchOptions = {
            filter: [
                { field: "project_id", operator: "=", value: project_id },
                { field: "ctd_imported", operator: "=", value: 1 },
            ],
            sort_by: [],
            page: 1,
            limit: 10000000,
        };

        return this.sampleRepository.standardGetSamples(options);
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({
            user_id: current_user.user_id,
            project_id: project_id,
        });

        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot list imported CTD samples in this project");
        }
    }
}
