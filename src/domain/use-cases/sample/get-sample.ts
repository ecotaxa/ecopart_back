import { PublicSampleModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetSampleUseCase } from "../../interfaces/use-cases/sample/get-sample";

export class GetSample implements GetSampleUseCase {
    userRepository: UserRepository;
    sampleRepository: SampleRepository;
    privilegeRepository: PrivilegeRepository;

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository;
        this.sampleRepository = sampleRepository;
        this.privilegeRepository = privilegeRepository;
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_id: number): Promise<PublicSampleModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);

        const sample = await this.sampleRepository.getSample({ sample_id });
        if (!sample) throw new Error("Cannot find sample");
        if (sample.project_id !== Number(project_id)) throw new Error("Sample does not belong to project");

        return sample;
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot access this project");
        }
    }
}
