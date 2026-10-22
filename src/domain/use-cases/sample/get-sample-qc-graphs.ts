import { SampleQcGraphsResponseModel } from "../../entities/sample-qc-graph";
import { UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetSampleQcGraphsUseCase } from "../../interfaces/use-cases/sample/get-sample-qc-graphs";
import { buildSampleQcGraphs } from "./qc-graphs-builder";
import { ProjectAccessPolicy } from "../project/project-access";

export class GetSampleQcGraphs implements GetSampleQcGraphsUseCase {
    userRepository: UserRepository;
    sampleRepository: SampleRepository;
    projectRepository: ProjectRepository;
    privilegeRepository: PrivilegeRepository;
    private readonly access: ProjectAccessPolicy;

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository;
        this.sampleRepository = sampleRepository;
        this.projectRepository = projectRepository;
        this.privilegeRepository = privilegeRepository;
        this.access = new ProjectAccessPolicy(userRepository, privilegeRepository);
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_id: number): Promise<SampleQcGraphsResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        const project = await this.ensureUserCanGet(current_user, project_id);

        const sample = await this.sampleRepository.getSample({ sample_id });
        if (!sample) throw new Error("Cannot find sample");
        if (sample.project_id !== Number(project_id)) throw new Error("Sample does not belong to project");

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
            descent_filter_enabled: project.enable_descent_filter,
            records,
        });
    }

    // QC graphs are "figures" in the access matrix: members and managers always, other users once
    // the project is visible.
    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<ProjectResponseModel> {
        const project = await this.projectRepository.getProject({ project_id: Number(project_id) });
        if (!project) throw new Error("Cannot find project");
        if (!await this.access.can(current_user.user_id, project, "figures")) {
            throw new Error("Logged user cannot access this project");
        }
        return project;
    }
}
