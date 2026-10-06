import { RegeneratePivotsOptions } from "../../entities/pivot";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PreparedSearchOptions } from "../../entities/search";
import { PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { RegeneratePivotsUseCase } from "../../interfaces/use-cases/sample/regenerate-pivots";
import { describeUvp5PivotReport, UVP5_PIVOT_CONVERTER_VERSION } from "../../utils/uvp5-pivot-converter";

// Builds the UVP6 pivot of UVP5 samples imported before the pivot existed, and rebuilds the ones
// written by an older converter version.
export class RegeneratePivots implements RegeneratePivotsUseCase {
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository
    sampleRepository: SampleRepository
    taskRepository: TaskRepository

    constructor(userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository, sampleRepository: SampleRepository, taskRepository: TaskRepository) {
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
        this.sampleRepository = sampleRepository
        this.taskRepository = taskRepository
    }

    async execute(current_user: UserUpdateModel, project_id: number, options: RegeneratePivotsOptions): Promise<TaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanRegenerate(current_user, project_id);

        const project = await this.getProjectIfExist(project_id);
        if (!project.instrument_model.startsWith("UVP5")) {
            throw new Error("Pivots only exist for UVP5 projects");
        }
        const samples = await this.getSamplesToRegenerate(project, options.sample_names);

        const task_id = await this.createRegeneratePivotsTask(current_user, project, options);
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        this.startRegeneratePivotsTask(task, project, samples, options.force === true);

        return task;
    }

    private async ensureUserCanRegenerate(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({
            user_id: current_user.user_id,
            project_id: project_id
        });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot regenerate pivots in this project");
        }
    }

    private async getProjectIfExist(project_id: number): Promise<ProjectResponseModel> {
        const project = await this.projectRepository.getProject({ project_id: project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }
        return project;
    }

    private async getSamplesToRegenerate(project: ProjectResponseModel, sample_names: string[] | undefined): Promise<PublicSampleModel[]> {
        const options: PreparedSearchOptions = {
            filter: [{ field: "project_id", operator: "=", value: project.project_id }],
            sort_by: [],
            page: 1,
            limit: 10000000,
        };
        const result = await this.sampleRepository.standardGetSamples(options);
        if (!sample_names || sample_names.length === 0) {
            if (result.items.length === 0) {
                throw new Error("No samples in this project");
            }
            return result.items;
        }
        const samples_by_name = new Map(result.items.map((sample) => [sample.sample_name, sample]));
        const missing = sample_names.filter((name) => !samples_by_name.has(name));
        if (missing.length > 0) {
            throw new Error("Samples not found in this project: " + missing.join(", "));
        }
        return sample_names.map((name) => samples_by_name.get(name) as PublicSampleModel);
    }

    private async createRegeneratePivotsTask(current_user: UserUpdateModel, project: ProjectResponseModel, options: RegeneratePivotsOptions): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Regenerate_Pivot,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { sample_names: options.sample_names ?? [], force: options.force === true }
        }
        return await this.taskRepository.createTask(task);
    }

    // One failing sample does not stop the others: the task fails at the end, listing every failure.
    private async startRegeneratePivotsTask(task: TaskResponseModel, project: ProjectResponseModel, samples: PublicSampleModel[], force: boolean): Promise<void> {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id: task_id });
            const failures: string[] = [];
            for (const [i, sample] of samples.entries()) {
                const progress = Math.round(((i + 1) / samples.length) * 99);
                const version = await this.sampleRepository.getPivotConverterVersion(project.project_id, sample.sample_name);
                if (!force && version === UVP5_PIVOT_CONVERTER_VERSION) {
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, `${sample.sample_name}: pivot already at converter version ${version}, kept`);
                    continue;
                }
                try {
                    const report = await this.sampleRepository.generateUvp5Pivot(project.project_id, sample, project.instrument_model);
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, describeUvp5PivotReport(report));
                } catch (error) {
                    failures.push((error as Error).message);
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, (error as Error).message);
                }
            }
            if (failures.length > 0) {
                throw new Error(`Pivot regeneration failed for ${failures.length} of ${samples.length} sample(s). ${failures.join(" | ")}`);
            }
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }
}
