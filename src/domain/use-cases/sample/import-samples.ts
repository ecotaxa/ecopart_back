
import { PublicSampleResponseModel } from "../../entities/sample";
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

        const samples = await this.listImportableSamples(project);

        // Check that asked samples are in the importable list of samples
        this.ensureSamplesAreImportables(samples, samples_names_to_import);

        // create a task to import samples
        const task_id = await this.createImportSamplesTask(current_user, project, samples_names_to_import);

        // get the task
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // start the task
        this.startImportTask(task, samples_names_to_import, project.instrument_model, project);

        return task;
    }
    ensureSamplesAreImportables(samples: PublicSampleResponseModel[], samples_names_to_import: string[]) {
        this.ensureSamplesAreBothInHeadersAndInRawData(samples, samples_names_to_import);
        this.ensureSamplesAreNotAlreadyImported(samples_names_to_import);
    }

    ensureSamplesAreBothInHeadersAndInRawData(samples: PublicSampleResponseModel[], samples_names_to_import: string[]) {
        const samples_names_set = new Set(samples.map(sample => sample.sample_name));

        const missing_samples = samples_names_to_import.filter(sample_id => !samples_names_set.has(sample_id));

        if (missing_samples.length > 0) {
            throw new Error("Samples not importable: " + missing_samples.join(", "));
        }
    }

    ensureSamplesAreNotAlreadyImported(samples_names_to_import: string[]) {
        //TODO
        console.log("TODO: ensureSamplesAreNotAlreadyImported please do an import update", samples_names_to_import);
    }

    createImportSamplesTask(current_user: UserUpdateModel, project: ProjectResponseModel, samples: string[]) {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Import,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { samples: samples }
        }
        return this.taskRepository.createTask(task);

    }

    private async listImportableSamples(project: ProjectResponseModel): Promise<PublicSampleResponseModel[]> {
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const samples = await this.sampleRepository.listImportableSamples(project.root_folder_path, project.instrument_model);
        // Ensure the task to get exists
        if (!samples) { throw new Error("No samples to import"); }

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

    private async startImportTask(task: TaskResponseModel, samples_names_to_import: string[], instrument_model: string, project: ProjectResponseModel) {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id: task_id });

            // 1/4 Do validation before importing
            //TODO LATER 

            // 2/4 Copy source files to hiden project folder 
            await this.copySourcesToProjectFolder(task_id, samples_names_to_import, instrument_model, project);

            // 3/4 Import samples
            //await this.sampleRepository.importSamples(task_id, project.project_id, samples_names_to_import);

            // 4/4 generate qc report by samples
            //TODO LATER but we can already et the qc flag to un validated

            // finish task
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            this.taskRepository.failedTask(task_id, error);
        }

    }

    async copySourcesToProjectFolder(task_id: number, samples_names_to_import: string[], instrument_model: string, project: ProjectResponseModel) {
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const root_folder_path = project.root_folder_path;
        let source_folder;

        if (instrument_model.startsWith('UVP6')) {
            source_folder = path.join(root_folder_path, 'ecodata');
        } else if (instrument_model.startsWith('UVP5')) {
            source_folder = path.join(root_folder_path, 'work');
        } else {
            throw new Error("Unknown instrument model");
        }
        await this.sampleRepository.copySamplesToImportFolder(source_folder, dest_folder, samples_names_to_import);
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 50, "Step 2/4 sample folders copied");

    }

    // async importSamples(task_id: number, project_id: number, samples_names_to_import: string[]) {

    // }
}