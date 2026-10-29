import { TASK_CANCELLED_MESSAGE } from "../../constants/task";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskLogger, TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteSampleUseCase } from "../../interfaces/use-cases/sample/delete-sample";
import { deleteOneSample, resolveEcoTaxaCleanup } from "./sample-deletion";

// Deletes samples of a project as a DELETE_SAMPLE task: each sample loses its EcoTaxa objects, its
// database row and its storage folder, in that order. One failing sample does not stop the others.
export class DeleteSample implements DeleteSampleUseCase {
    userRepository: UserRepository
    sampleRepository: SampleRepository
    privilegeRepository: PrivilegeRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository
    projectRepository: ProjectRepository
    taskRepository: TaskRepository

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, privilegeRepository: PrivilegeRepository, ecotaxaAccountRepository: EcotaxaAccountRepository, projectRepository: ProjectRepository, taskRepository: TaskRepository) {
        this.userRepository = userRepository
        this.sampleRepository = sampleRepository
        this.privilegeRepository = privilegeRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
        this.projectRepository = projectRepository
        this.taskRepository = taskRepository
    }

    async execute(current_user: UserUpdateModel, project_id: number, sample_ids: number[]): Promise<PublicTaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanDelete(current_user, project_id);
        const project = await this.getProjectIfExist(project_id);
        const samples = await this.getSamplesToDelete(project_id, sample_ids);

        const task_id = await this.createDeleteSamplesTask(current_user, project, samples);
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // Fire-and-forget: failures are recorded on the task inside; only a failure to record one (task deleted
        // meanwhile, database unavailable) reaches this catch, which keeps it from stopping the server.
        this.startDeleteSamplesTask(task, project, samples)
            .catch((error) => console.log(new Date().toISOString(), `Sample deletion task ${task.task_id} could not record its outcome`, error));

        return this.taskRepository.toPublicTask(task);
    }

    // Admin, or manager of the project
    private async ensureUserCanDelete(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isManager({
            user_id: current_user.user_id,
            project_id: project_id
        });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot delete samples in this project");
        }
    }

    private async getProjectIfExist(project_id: number): Promise<ProjectResponseModel> {
        const project = await this.projectRepository.getProject({ project_id: project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }
        return project;
    }

    // Every sample must exist and belong to the project, otherwise nothing is deleted.
    private async getSamplesToDelete(project_id: number, sample_ids: number[]): Promise<PublicSampleModel[]> {
        const unique_ids = Array.from(new Set(sample_ids));
        if (unique_ids.length === 0) {
            throw new Error("No samples to delete");
        }
        const samples: PublicSampleModel[] = [];
        for (const sample_id of unique_ids) {
            const sample = await this.sampleRepository.getSample({ sample_id: sample_id });
            if (!sample) {
                throw new Error("Cannot find sample to delete");
            }
            if (sample.project_id != project_id) {
                throw new Error("The given project_id does not match the sample's project_id");
            }
            samples.push(sample);
        }
        return samples;
    }

    // Refused while the project itself is being deleted. Several sample deletions may run at once on a
    // project: they target different samples.
    private async createDeleteSamplesTask(current_user: UserUpdateModel, project: ProjectResponseModel, samples: PublicSampleModel[]): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Delete_Sample,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { sample_ids: samples.map(s => s.sample_id), sample_names: samples.map(s => s.sample_name) }
        }
        const task_id = await this.taskRepository.createTaskUnlessActive(task, [TaskType.Delete_Project]);
        if (task_id === null) {
            throw new Error("The project is being deleted");
        }
        return task_id;
    }

    // A cancellation is honoured between two samples: the samples already deleted stay deleted, the
    // others are kept. A sample whose EcoTaxa objects cannot be deleted is kept, to be retried.
    private async startDeleteSamplesTask(task: TaskResponseModel, project: ProjectResponseModel, samples: PublicSampleModel[]): Promise<void> {
        const task_id = task.task_id;
        // Best effort: a log line that cannot be written must not stop a deletion half-way
        const log: TaskLogger = (message) => this.taskRepository.logMessage(task.task_log_file_path, message).catch(() => undefined);
        let deleted = 0;
        try {
            await this.taskRepository.startTask({ task_id: task_id });
            await log(`Deleting ${samples.length} sample(s) from project ${project.project_id} "${project.project_title}" : ${samples.map(s => s.sample_name).join(", ")}`);

            const ecotaxa = samples.some(s => s.ecotaxa_sample_imported)
                ? await resolveEcoTaxaCleanup(this.ecotaxaAccountRepository, project, log)
                : null;

            const failures: string[] = [];
            for (const [i, sample] of samples.entries()) {
                await this.taskRepository.throwIfCancelled(task_id);
                const progress = Math.round(((i + 1) / samples.length) * 99);
                try {
                    await deleteOneSample(this.sampleRepository, this.ecotaxaAccountRepository, project.project_id, sample, ecotaxa, "keep sample", log);
                    deleted++;
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, `${sample.sample_name} deleted (${i + 1}/${samples.length})`);
                } catch (error) {
                    failures.push(`${sample.sample_name} : ${(error as Error).message}`);
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, `${sample.sample_name} not deleted : ${(error as Error).message}`);
                }
            }
            if (failures.length > 0) {
                throw new Error(`Deletion failed for ${failures.length} of ${samples.length} sample(s). ${failures.join(" | ")}`);
            }
            await this.taskRepository.finishTask({ task_id: task_id }, `${deleted} sample(s) deleted from project ${project.project_id}`);
        } catch (error) {
            if ((error as Error).message === TASK_CANCELLED_MESSAGE) {
                await log(`Deletion stopped : ${deleted} of ${samples.length} sample(s) deleted, the others are kept`);
            }
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }
}
