
import { PublicHeaderSampleResponseModel, SampleRequestCreationModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";

import { ImportSamplesUseCase } from "../../interfaces/use-cases/sample/import-samples";
import { ProjectResponseModel } from "../../entities/project";
import { PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import path from "path";

export class ImportSamples implements ImportSamplesUseCase {
    sampleRepository: SampleRepository
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository
    taskRepository: TaskRepository
    DATA_STORAGE_FS_STORAGE: string

    constructor(sampleRepository: SampleRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository, taskRepository: TaskRepository, DATA_STORAGE_FS_STORAGE: string) {
        this.sampleRepository = sampleRepository
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
        this.taskRepository = taskRepository
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
    }

    async execute(current_user: UserUpdateModel, project_id: number, samples_names_to_import: string[]): Promise<TaskResponseModel> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to get the project importable samples
        await this.ensureUserCanGet(current_user, project_id);

        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        // create a task to import samples
        const task_id = await this.createImportSamplesTask(current_user, project, samples_names_to_import);

        // get the task
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // start the task
        this.startImportTask(task, samples_names_to_import, project.instrument_model, project, current_user);

        return task;
    }

    async createImportSamplesTask(current_user: UserUpdateModel, project: ProjectResponseModel, samples: string[]): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Import,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { samples: samples }
        }
        return await this.taskRepository.createTask(task);
    }

    private async listImportableSamples(project: ProjectResponseModel): Promise<PublicHeaderSampleResponseModel[]> {
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const samples = await this.sampleRepository.listImportableSamples(project.root_folder_path, project.instrument_model, dest_folder, project.project_id);
        if (samples.length === 0) { throw new Error("No samples to import"); }

        return samples;
    }

    private async getProjectIfExist(project_id: number): Promise<ProjectResponseModel> {
        const project = await this.projectRepository.getProject({ project_id: project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }
        return project;
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({
            user_id: current_user.user_id,
            project_id: project_id
        });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot list importable samples in this project");
        }
    }

    private async startImportTask(task: TaskResponseModel, samples_names_to_import: string[], instrument_model: string, project: ProjectResponseModel, current_user: UserUpdateModel) {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id: task_id });

            // 1/4 Do validation before importing
            const importable_samples = await this.listImportableSamples(project);
            // Check that asked samples are in the importable list of samples
            await this.ensureSamplesAreImportables(importable_samples, samples_names_to_import, task_id);

            // 2/4 Copy source files to hiden project folder 
            await this.copySourcesToProjectFolder(task_id, samples_names_to_import, instrument_model, project);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error);
            return;
        }
        try {
            // 3/4 generate qc report by samples
            //TODO LATER but we can already et the qc flag to un validated

            // 4/4 Create samples
            await this.importSamples(task_id, project, current_user.user_id, samples_names_to_import);

            // finish task
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            await this.deleteSourcesFromProjectFolder(task_id, samples_names_to_import, project);
            this.taskRepository.failedTask(task_id, error);
        }
    }
    async ensureSamplesAreImportables(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[], task_id: number) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 10, "Step 1/4 sample validation : start");
        this.ensureSamplesAreBothInHeadersAndInRawData(samples, samples_names_to_import);
        //TODO LATER add more validation
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 20, "Step 1/4 sample validation : done");

    }

    ensureSamplesAreBothInHeadersAndInRawData(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[]) {
        const samples_names_set = new Set(samples.map(sample => sample.sample_name));

        const missing_samples = samples_names_to_import.filter(sample_id => !samples_names_set.has(sample_id));

        if (missing_samples.length > 0) {
            throw new Error("Samples not importable: " + missing_samples.join(", "));
        }
    }

    async copySourcesToProjectFolder(task_id: number, samples_names_to_import: string[], instrument_model: string, project: ProjectResponseModel) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 25, "Step 2/4 sample folders copy : start");

        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const root_folder_path = project.root_folder_path;
        let source_folder;

        if (instrument_model.startsWith('UVP6')) {
            source_folder = path.join(root_folder_path, 'ecodata');
            await this.sampleRepository.UVP6copySamplesToImportFolder(source_folder, dest_folder, samples_names_to_import);
        } else if (instrument_model.startsWith('UVP5')) {
            await this.sampleRepository.UVP5copySamplesToImportFolder(root_folder_path, dest_folder, samples_names_to_import);
        } else {
            throw new Error("Unknown instrument model");
        }
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 50, "Step 2/4 sample folders copy : done");
    }

    async deleteSourcesFromProjectFolder(task_id: number, samples_names_to_import: string[], project: ProjectResponseModel) {
        // Delete sources files from project folder
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        await this.sampleRepository.deleteSamplesFromImportFolder(dest_folder, samples_names_to_import);
        // Log the action
        const task_file_path = await this.taskRepository.getTask({ task_id });
        if (!task_file_path) {
            throw new Error("Cannot find task");
        }
        await this.taskRepository.logMessage(task_file_path.task_log_file_path, "Samples import failed, sources files deleted for samples: " + samples_names_to_import.join(", "));
    }

    async importSamples(task_id: number, project: ProjectResponseModel, current_user_id: number, samples_names_to_import: string[]): Promise<number[]> {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 75, "Step 4/4 samples db creation : start");

        // Common sample data
        const base_sample: Partial<SampleRequestCreationModel> = {
            project_id: project.project_id,
            visual_qc_validator_user_id: current_user_id
        }
        // Format samples to import
        const formated_samples: SampleRequestCreationModel[] = await Promise.all(
            samples_names_to_import.map(async (sample_name) => {
                const sample = await this.sampleRepository.formatSampleToImport(
                    { ...base_sample, sample_name },
                    project.instrument_model
                );
                return sample;
            })
        );
        // Create samples
        const created_samples_ids = await this.sampleRepository.createManySamples(formated_samples);

        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 100, "Step 4/4 samples db creation done");
        return created_samples_ids;
    }
}