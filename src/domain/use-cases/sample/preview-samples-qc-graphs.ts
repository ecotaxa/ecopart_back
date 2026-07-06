import path from "path";

import { SampleQcGraphsResponseModel } from "../../entities/sample-qc-graph";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { PreviewSamplesQcGraphsUseCase } from "../../interfaces/use-cases/sample/preview-samples-qc-graphs";
import { buildSampleQcGraphs } from "./qc-graphs-builder";

// Status label for a sample that has not been imported yet (no DB row, no visual_qc_status).
const NOT_IMPORTED_LABEL = "NOT_IMPORTED";

export class PreviewSamplesQcGraphs implements PreviewSamplesQcGraphsUseCase {
    userRepository: UserRepository;
    sampleRepository: SampleRepository;
    projectRepository: ProjectRepository;
    privilegeRepository: PrivilegeRepository;
    DATA_STORAGE_FS_STORAGE: string;

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository, DATA_STORAGE_FS_STORAGE: string) {
        this.userRepository = userRepository;
        this.sampleRepository = sampleRepository;
        this.projectRepository = projectRepository;
        this.privilegeRepository = privilegeRepository;
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE;
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_names: string[]): Promise<SampleQcGraphsResponseModel[]> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);

        if (!sample_names || sample_names.length === 0) throw new Error("No samples to preview");

        const project = await this.projectRepository.getProject({ project_id });
        if (!project) throw new Error("Cannot find project");

        // Security: only names actually importable from the source folder are allowed — this
        // prevents using the endpoint to read arbitrary paths via a crafted sample name.
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const importable = await this.sampleRepository.listImportableSamples(project.root_folder_path, project.instrument_model, dest_folder, project.project_id);
        const importable_names = new Set(importable.map((s) => s.sample_name));
        const not_importable = sample_names.filter((name) => !importable_names.has(name));
        if (not_importable.length > 0) throw new Error("Samples not importable: " + not_importable.join(", "));

        // Read sequentially: the UVP5 .bru can be ~100 MB, so we avoid holding several in memory.
        const results: SampleQcGraphsResponseModel[] = [];
        for (const sample_name of sample_names) {
            const [records, meta] = await Promise.all([
                this.sampleRepository.getPerImageRecordsFromSource(project.root_folder_path, sample_name, project.instrument_model),
                this.sampleRepository.getSourceFilterMetadata(project.root_folder_path, sample_name, project.instrument_model),
            ]);
            results.push(buildSampleQcGraphs({
                sample_id: null,
                sample_name,
                instrument_model: project.instrument_model,
                visual_qc_status_label: NOT_IMPORTED_LABEL,
                filter_first_image: meta.filter_first_image,
                filter_last_image: meta.filter_last_image,
                instrument_settings_depth_offset_m: meta.instrument_settings_depth_offset_m,
                instrument_settings_image_volume_l: meta.instrument_settings_image_volume_l,
                is_depth_profile: meta.sample_type_label === "Depth",
                records,
            }));
        }
        return results;
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot access this project");
        }
    }
}
