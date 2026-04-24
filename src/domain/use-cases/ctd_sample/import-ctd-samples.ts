import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";

import { ImportCTDSamplesUseCase } from "../../interfaces/use-cases/ctd_sample/import-ctd-samples";

import { UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";

export class ImportCTDSamples implements ImportCTDSamplesUseCase {
    sampleRepository: SampleRepository;
    userRepository: UserRepository;
    privilegeRepository: PrivilegeRepository;
    projectRepository: ProjectRepository;
    taskRepository: TaskRepository;

    constructor(sampleRepository: SampleRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository, taskRepository: TaskRepository) {
        this.sampleRepository = sampleRepository;
        this.userRepository = userRepository;
        this.privilegeRepository = privilegeRepository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
    }

    async execute(current_user: UserUpdateModel, project_id: number, samples_names_to_import: string[]): Promise<TaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);

        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        const task_id = await this.createImportCTDSamplesTask(current_user, project, samples_names_to_import);

        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        this.startImportCTDSamplesTask(task, samples_names_to_import, project);

        return task;
    }

    async createImportCTDSamplesTask(current_user: UserUpdateModel, project: ProjectResponseModel, samples: string[]): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Import_CTD,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { samples: samples },
        };
        return await this.taskRepository.createTask(task);
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
            project_id: project_id,
        });

        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot import CTD samples in this project");
        }
    }

    private async startImportCTDSamplesTask(task: TaskResponseModel, samples_names_to_import: string[], project: ProjectResponseModel) {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id: task_id });
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 10, "Step 1/3 CTD sample validation: start");

            const importable_samples = await this.sampleRepository.listImportableCTDSamples(project.root_folder_path, project.instrument_model, project.project_id);
            this.ensureCTDSamplesAreImportables(importable_samples, samples_names_to_import);

            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 50, "Step 2/3 CTD sample copy: start");
            await this.sampleRepository.importCTDSamples(project.root_folder_path, project.instrument_model, project.project_id, samples_names_to_import);

            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 100, "Step 3/3 CTD sample import: done");
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }

    private ensureCTDSamplesAreImportables(importable_samples: string[], samples_names_to_import: string[]) {
        const importable_set = new Set(importable_samples);
        const missing_samples = samples_names_to_import.filter((sample_name) => !importable_set.has(sample_name));

        if (missing_samples.length > 0) {
            throw new Error("CTD samples not importable: " + missing_samples.join(", "));
        }
    }
}
