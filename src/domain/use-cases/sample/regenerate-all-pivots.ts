import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PreparedSearchOptions } from "../../entities/search";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskLogger, TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { RegenerateAllPivotsRequestModel, RegenerateAllPivotsUseCase } from "../../interfaces/use-cases/sample/regenerate-all-pivots";
import { PivotOutcome, regenerateSamplePivot } from "./regenerate-pivots";

// The pivot regeneration of every UVP5 project (or of the asked ones), in one task that belongs to no
// project. Administrators only.
export class RegenerateAllPivots implements RegenerateAllPivotsUseCase {
    constructor(
        private userRepository: UserRepository,
        private projectRepository: ProjectRepository,
        private sampleRepository: SampleRepository,
        private taskRepository: TaskRepository,
    ) { }

    async execute(current_user: UserUpdateModel, request: RegenerateAllPivotsRequestModel): Promise<PublicTaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) {
            throw new Error("Logged user cannot regenerate pivots");
        }

        const project_ids = Array.from(new Set((request.project_ids ?? []).map(Number)));
        const force = request.force === true;

        const task_id = await this.taskRepository.createTask({
            task_type: TaskType.Regenerate_Pivot,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            // Cross-project task: keep task_project_id unset.
            task_params: { project_ids, force },
        } as PublicTaskRequestCreationModel);
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // Fire-and-forget: failures are recorded on the task inside; only a failure to record one (task deleted
        // meanwhile, database unavailable) reaches this catch, which keeps it from stopping the server.
        this.startRegenerateAllPivotsTask(task, project_ids, force)
            .catch((error) => console.log(new Date().toISOString(), `Pivot regeneration task ${task.task_id} could not record its outcome`, error));

        return this.taskRepository.toPublicTask(task);
    }

    // One failing sample does not stop the others: the task fails at the end with the counts when any failed.
    private async startRegenerateAllPivotsTask(task: TaskResponseModel, project_ids: number[], force: boolean): Promise<void> {
        const task_id = task.task_id;
        const log: TaskLogger = (message) => this.taskRepository.logMessage(task.task_log_file_path, message);
        try {
            await this.taskRepository.startTask({ task_id: task_id });
            const projects = await this.getUvp5Projects(project_ids, log);
            const counts = await this.sampleRepository.countSamplesPerProject(projects.map((project) => project.project_id));
            const total = projects.reduce((sum, project) => sum + (counts.get(project.project_id) ?? 0), 0);
            await log(`${projects.length} UVP5 project(s), ${total} sample(s) to look at${force ? ", pivots already at the current converter version are rebuilt" : ""}`);

            const outcomes: Record<PivotOutcome, number> = { rebuilt: 0, kept: 0, failed: 0 };
            let done = 0;
            for (const project of projects) {
                for (const sample of await this.getSamples(project)) {
                    await this.taskRepository.throwIfCancelled(task_id);
                    done++;
                    const progress = Math.min(99, Math.round((done / Math.max(total, 1)) * 99));
                    const outcome = await regenerateSamplePivot(this.sampleRepository, this.taskRepository, task, project, sample, force, async (message) => {
                        await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, `Project ${project.project_id} : ${message}`);
                    });
                    outcomes[outcome]++;
                }
            }

            const summary = `Pivots rebuilt for ${outcomes.rebuilt} sample(s), ${outcomes.kept} kept, ${outcomes.failed} failed`;
            await log(summary);
            if (outcomes.failed > 0) {
                throw new Error(`Pivot regeneration failed for ${outcomes.failed} of ${done} sample(s): see the task log. ${summary}`);
            }
            await this.taskRepository.finishTask({ task_id: task_id }, summary);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }

    // Every UVP5 project, or the asked ones that exist and are UVP5.
    private async getUvp5Projects(project_ids: number[], log: TaskLogger): Promise<ProjectResponseModel[]> {
        const isUvp5 = (project: ProjectResponseModel) => project.instrument_model.startsWith("UVP5");
        if (project_ids.length === 0) return (await this.projectRepository.listProjects()).filter(isUvp5);
        const projects: ProjectResponseModel[] = [];
        for (const project_id of project_ids) {
            const project = await this.projectRepository.getProject({ project_id: project_id });
            if (!project) await log(`Project ${project_id} : not found, skipped`);
            else if (!isUvp5(project)) await log(`Project ${project_id} : skipped, pivots only exist for UVP5 projects`);
            else projects.push(project);
        }
        return projects;
    }

    private async getSamples(project: ProjectResponseModel): Promise<PublicSampleModel[]> {
        const options: PreparedSearchOptions = {
            filter: [{ field: "project_id", operator: "=", value: project.project_id }],
            sort_by: [],
            page: 1,
            limit: 10000000,
        };
        return (await this.sampleRepository.standardGetSamples(options)).items;
    }
}
