import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PreparedSearchOptions } from "../../entities/search";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskLogger, TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ComputeParticleStatsRequestModel, ComputeParticleStatsUseCase } from "../../interfaces/use-cases/sample/compute-particle-stats";
import { binnedSampleSettingsOf } from "../export/binned-settings";
import { computeParticleStats, describeParticleStats } from "./particle-stats";

type SampleOutcome = "computed" | "skipped" | "failed";

// Particle statistics of the samples imported before the import computed them (or of every sample,
// forced), read from their pivots. Administrators only, across projects.
export class ComputeParticleStats implements ComputeParticleStatsUseCase {
    constructor(
        private userRepository: UserRepository,
        private projectRepository: ProjectRepository,
        private sampleRepository: SampleRepository,
        private taskRepository: TaskRepository,
    ) { }

    async execute(current_user: UserUpdateModel, request: ComputeParticleStatsRequestModel): Promise<PublicTaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) {
            throw new Error("Logged user cannot compute particle stats");
        }

        const project_ids = Array.from(new Set((request.project_ids ?? []).map(Number)));
        const force = request.force === true;

        const task_id = await this.taskRepository.createTask({
            task_type: TaskType.Compute_Particle_Stats,
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
        this.startComputeParticleStatsTask(task, project_ids, force)
            .catch((error) => console.log(new Date().toISOString(), `Particle statistics task ${task.task_id} could not record its outcome`, error));

        return this.taskRepository.toPublicTask(task);
    }

    // One failing sample does not stop the others: it is counted, and the summary gives the counts.
    private async startComputeParticleStatsTask(task: TaskResponseModel, project_ids: number[], force: boolean): Promise<void> {
        const task_id = task.task_id;
        const log: TaskLogger = (message) => this.taskRepository.logMessage(task.task_log_file_path, message);
        try {
            await this.taskRepository.startTask({ task_id: task_id });
            const projects = await this.getProjects(project_ids, log);
            const counts = await this.sampleRepository.countSamplesPerProject(projects.map((project) => project.project_id));
            const total = projects.reduce((sum, project) => sum + (counts.get(project.project_id) ?? 0), 0);
            await log(`${projects.length} project(s), ${total} sample(s) to look at${force ? ", statistics already computed are recomputed" : ""}`);

            const outcomes: Record<SampleOutcome, number> = { computed: 0, skipped: 0, failed: 0 };
            let done = 0;
            for (const project of projects) {
                for (const sample of await this.getSamples(project)) {
                    await this.taskRepository.throwIfCancelled(task_id);
                    const { outcome, message } = await this.computeSample(project, sample, force);
                    outcomes[outcome]++;
                    done++;
                    const progress = Math.min(99, Math.round((done / Math.max(total, 1)) * 99));
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, `Project ${project.project_id} : ${message}`);
                }
            }

            const summary = `Particle statistics computed for ${outcomes.computed} sample(s), ${outcomes.skipped} skipped, ${outcomes.failed} failed`;
            await log(summary);
            await this.taskRepository.finishTask({ task_id: task_id }, summary);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }

    // Every project, or the asked ones that exist.
    private async getProjects(project_ids: number[], log: TaskLogger): Promise<ProjectResponseModel[]> {
        if (project_ids.length === 0) return await this.projectRepository.listProjects();
        const projects: ProjectResponseModel[] = [];
        for (const project_id of project_ids) {
            const project = await this.projectRepository.getProject({ project_id: project_id });
            if (project) projects.push(project);
            else await log(`Project ${project_id} : not found, skipped`);
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

    private async computeSample(project: ProjectResponseModel, sample: PublicSampleModel, force: boolean): Promise<{ outcome: SampleOutcome, message: string }> {
        const name = sample.sample_name;
        if (!force && typeof sample.nb_particles === "number") {
            return { outcome: "skipped", message: `${name}: particle statistics already computed, kept` };
        }
        const instrument_model = project.instrument_model;
        if (!instrument_model.startsWith("UVP5") && !instrument_model.startsWith("UVP6")) {
            return { outcome: "skipped", message: `${name}: skipped, no particle statistics for the instrument ${instrument_model}` };
        }
        try {
            if (instrument_model.startsWith("UVP5") && await this.sampleRepository.getPivotConverterVersion(project.project_id, name) === null) {
                return { outcome: "skipped", message: `${name}: skipped, the sample has no pivot. Run the pivot regeneration of project ${project.project_id}, which also computes its particle statistics` };
            }
            const pivot = await this.sampleRepository.getPivotImages(project.project_id, name, instrument_model);
            const stats = await computeParticleStats(binnedSampleSettingsOf(sample, project), pivot);
            await this.sampleRepository.updateParticleStats(sample.sample_id, stats);
            return { outcome: "computed", message: describeParticleStats(name, stats) };
        } catch (error) {
            return { outcome: "failed", message: `${name}: FAILED ${(error as Error).message}` };
        }
    }
}
