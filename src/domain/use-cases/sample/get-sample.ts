import { PublicSampleModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetSampleUseCase } from "../../interfaces/use-cases/sample/get-sample";
import { ProjectAccessPolicy } from "../project/project-access";

export class GetSample implements GetSampleUseCase {
    userRepository: UserRepository;
    sampleRepository: SampleRepository;
    privilegeRepository: PrivilegeRepository;
    projectRepository: ProjectRepository;
    private readonly access: ProjectAccessPolicy;

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository) {
        this.userRepository = userRepository;
        this.sampleRepository = sampleRepository;
        this.privilegeRepository = privilegeRepository;
        this.projectRepository = projectRepository;
        this.access = new ProjectAccessPolicy(userRepository, privilegeRepository);
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_id: number): Promise<PublicSampleModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);

        const sample = await this.sampleRepository.getSample({ sample_id });
        if (!sample) throw new Error("Cannot find sample");
        if (sample.project_id !== Number(project_id)) throw new Error("Sample does not belong to project");

        return sample;
    }

    // A sample is "figures" in the access matrix: members and managers always, other users once
    // the project is visible.
    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const project = await this.projectRepository.getProject({ project_id: Number(project_id) });
        if (!project) throw new Error("Cannot find project");
        if (!await this.access.can(current_user.user_id, project, "figures")) {
            throw new Error("Logged user cannot access this project");
        }
    }
}
