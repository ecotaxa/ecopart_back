import { PublicSampleModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SelectSampleCoordinatesUseCase } from "../../interfaces/use-cases/sample/select-sample-coordinates";

export class SelectSampleCoordinates implements SelectSampleCoordinatesUseCase {
    userRepository: UserRepository;
    sampleRepository: SampleRepository;
    privilegeRepository: PrivilegeRepository;

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository;
        this.sampleRepository = sampleRepository;
        this.privilegeRepository = privilegeRepository;
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_id: number, use_ctd_coordinates: boolean): Promise<PublicSampleModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanUpdate(current_user, project_id);

        const sample = await this.sampleRepository.getSample({ sample_id });
        if (!sample) throw new Error("Cannot find sample");
        if (sample.project_id !== Number(project_id)) throw new Error("Sample does not belong to project");
        if (use_ctd_coordinates && (sample.ctd_latitude === null || sample.ctd_longitude === null)) {
            throw new Error("Sample has no CTD coordinates");
        }

        const nb_updated = await this.sampleRepository.standardUpdateManySamples({ use_ctd_coordinates }, { sample_id });
        if (nb_updated === 0) throw new Error("Cannot update sample coordinates selection");

        const updated_sample = await this.sampleRepository.getSample({ sample_id });
        if (!updated_sample) throw new Error("Cannot find updated sample");
        return updated_sample;
    }

    private async ensureUserCanUpdate(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot update samples in this project");
        }
    }
}
