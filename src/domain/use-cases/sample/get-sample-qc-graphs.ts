import { SampleQcGraphsResponseModel } from "../../entities/sample-qc-graph";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetSampleQcGraphsUseCase } from "../../interfaces/use-cases/sample/get-sample-qc-graphs";
import { buildSampleQcGraphs } from "./qc-graphs-builder";

export class GetSampleQcGraphs implements GetSampleQcGraphsUseCase {
    userRepository: UserRepository;
    sampleRepository: SampleRepository;
    projectRepository: ProjectRepository;
    privilegeRepository: PrivilegeRepository;

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository;
        this.sampleRepository = sampleRepository;
        this.projectRepository = projectRepository;
        this.privilegeRepository = privilegeRepository;
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_id: number): Promise<SampleQcGraphsResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);

        const sample = await this.sampleRepository.getSample({ sample_id });
        if (!sample) throw new Error("Cannot find sample");
        if (sample.project_id !== Number(project_id)) throw new Error("Sample does not belong to project");

        const project = await this.projectRepository.getProject({ project_id: sample.project_id });
        if (!project) throw new Error("Cannot find project");
        const instrument_model = project.instrument_model;

        const records = await this.sampleRepository.getPerImageRecords(sample.project_id, sample.sample_name, instrument_model);

        return buildSampleQcGraphs({
            sample_id: sample.sample_id,
            sample_name: sample.sample_name,
            instrument_model,
            visual_qc_status_label: sample.visual_qc_status_label,
            filter_first_image: sample.filter_first_image ?? null,
            filter_last_image: sample.filter_last_image ?? null,
            instrument_settings_depth_offset_m: sample.instrument_settings_depth_offset_m ?? null,
            instrument_settings_image_volume_l: sample.instrument_settings_image_volume_l ?? null,
            is_depth_profile: sample.sample_type_label === "Depth",
            records,
        });
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot access this project");
        }
    }
}
