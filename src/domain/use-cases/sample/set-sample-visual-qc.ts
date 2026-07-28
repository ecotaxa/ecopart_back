import { PublicSampleModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SetSampleVisualQcUseCase } from "../../interfaces/use-cases/sample/set-sample-visual-qc";

const ALLOWED_STATUSES = ["VALIDATED", "REJECTED"];

export class SetSampleVisualQc implements SetSampleVisualQcUseCase {
    userRepository: UserRepository;
    sampleRepository: SampleRepository;
    privilegeRepository: PrivilegeRepository;

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository;
        this.sampleRepository = sampleRepository;
        this.privilegeRepository = privilegeRepository;
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_id: number, visual_qc_status_label: string, comment?: string | null): Promise<PublicSampleModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanValidate(current_user, project_id);

        if (!ALLOWED_STATUSES.includes(visual_qc_status_label)) {
            throw new Error("Invalid visual QC status");
        }

        const sample = await this.sampleRepository.getSample({ sample_id });
        if (!sample) throw new Error("Cannot find sample");
        if (sample.project_id !== Number(project_id)) throw new Error("Sample does not belong to project");

        const status = await this.sampleRepository.getVisualQCStatus({ visual_qc_status_label });
        if (!status) throw new Error("Visual QC status not found");

        const nb_updated = await this.sampleRepository.setSampleVisualQc(
            sample_id,
            status.visual_qc_status_id,
            current_user.user_id,
            comment ?? null,
            new Date().toISOString()
        );
        if (nb_updated === 0) throw new Error("Cannot update sample visual QC");

        const updated_sample = await this.sampleRepository.getSample({ sample_id });
        if (!updated_sample) throw new Error("Cannot find updated sample");
        return updated_sample;
    }

    private async ensureUserCanValidate(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot validate samples in this project");
        }
    }
}
