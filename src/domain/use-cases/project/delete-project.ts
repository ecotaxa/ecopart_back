import { TASK_CANCELLED_MESSAGE } from "../../constants/task";
import { ProjectRequestModel, ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PreparedSearchOptions } from "../../entities/search";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskLogger, TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteProjectUseCase } from "../../interfaces/use-cases/project/delete-project";
import { deleteOneSample, EcoTaxaCleanup, isLinkedToEcoTaxa, resolveEcoTaxaCleanup } from "../sample/sample-deletion";

// Deletes a project as a DELETE_PROJECT task: its samples one by one, its EcoTaxa project, its past tasks
// with their files, then its database row and its storage folder. The project is kept when a sample
// cannot be deleted. The source folder of the project is never touched.
export class DeleteProject implements DeleteProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    privilegeRepository: PrivilegeRepository
    sampleRepository: SampleRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository
    taskRepository: TaskRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository, sampleRepository: SampleRepository, ecotaxaAccountRepository: EcotaxaAccountRepository, taskRepository: TaskRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.privilegeRepository = privilegeRepository
        this.sampleRepository = sampleRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
        this.taskRepository = taskRepository
    }

    async execute(current_user: UserUpdateModel, project_to_delete: ProjectRequestModel): Promise<PublicTaskResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // The project is identified by its id alone: any other key would end up in the SQL WHERE
        // clause, and could select another project whose samples would then be deleted
        project_to_delete = { project_id: project_to_delete.project_id };

        const project = await this.ensureProjectExists(project_to_delete);
        await this.ensureUserCanDelete(current_user, project_to_delete);

        const task_id = await this.createDeleteProjectTask(current_user, project);
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // Fire-and-forget: failures are recorded on the task inside; only a failure to record one (task deleted
        // meanwhile, database unavailable) reaches this catch, which keeps it from stopping the server.
        this.startDeleteProjectTask(task, project)
            .catch((error) => console.log(new Date().toISOString(), `Project deletion task ${task.task_id} could not record its outcome`, error));

        return this.taskRepository.toPublicTask(task);
    }

    private async ensureProjectExists(project: ProjectRequestModel): Promise<ProjectResponseModel> {
        const found = await this.projectRepository.getProject(project);
        if (!found) {
            throw new Error("Cannot find project to delete");
        }
        return found;
    }

    // Admin, or manager of the project
    private async ensureUserCanDelete(current_user: UserUpdateModel, project: ProjectRequestModel): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isManager({
            user_id: current_user.user_id,
            project_id: project.project_id
        });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot delete this project");
        }
    }

    // Refused while any task runs on the project: its work would be deleted under it. The task is
    // attached to the project until the last step, which detaches it before deleting the project row.
    private async createDeleteProjectTask(current_user: UserUpdateModel, project: ProjectResponseModel): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Delete_Project,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { project_id: project.project_id, project_title: project.project_title }
        }
        const task_id = await this.taskRepository.createTaskUnlessActive(task, Object.values(TaskType));
        if (task_id === null) {
            throw new Error("A task is still running on this project");
        }
        return task_id;
    }

    // A cancellation is honoured between two samples: the project and its remaining samples are kept.
    private async startDeleteProjectTask(task: TaskResponseModel, project: ProjectResponseModel): Promise<void> {
        const task_id = task.task_id;
        const project_id = project.project_id;
        // Best effort: a log line that cannot be written must not stop a deletion half-way
        const log: TaskLogger = (message) => this.taskRepository.logMessage(task.task_log_file_path, message).catch(() => undefined);
        const warnings: string[] = [];
        let samples_total = 0;
        let samples_deleted = 0;
        try {
            await this.taskRepository.startTask({ task_id: task_id });
            const ecotaxa_link = isLinkedToEcoTaxa(project) ? `, linked to EcoTaxa project ${project.ecotaxa_project_id} on instance ${project.ecotaxa_instance_id}` : "";
            await log(`Deleting project ${project_id} "${project.project_title}" (${project.instrument_model}${ecotaxa_link})`);
            const ecotaxa = isLinkedToEcoTaxa(project) ? await resolveEcoTaxaCleanup(this.ecotaxaAccountRepository, project, log) : null;

            // Step 1/4: samples
            const samples = await this.getProjectSamples(project_id);
            samples_total = samples.length;
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 5, `Step 1/4 samples : ${samples.length} sample(s) to delete`);
            const failures: string[] = [];
            for (const [i, sample] of samples.entries()) {
                await this.taskRepository.throwIfCancelled(task_id);
                const progress = 5 + Math.round(((i + 1) / samples.length) * 65);
                try {
                    warnings.push(...await deleteOneSample(this.sampleRepository, this.ecotaxaAccountRepository, project_id, sample, ecotaxa, "continue", log));
                    samples_deleted++;
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, `Step 1/4 samples : ${sample.sample_name} deleted (${i + 1}/${samples.length})`);
                } catch (error) {
                    failures.push(`${sample.sample_name} : ${(error as Error).message}`);
                    await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, `Step 1/4 samples : ${sample.sample_name} not deleted : ${(error as Error).message}`);
                }
            }
            if (failures.length > 0) {
                throw new Error(`Project ${project_id} kept : deletion failed for ${failures.length} of ${samples.length} sample(s). ${failures.join(" | ")}`);
            }
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 70, `Step 1/4 samples : done, ${samples.length} sample(s) deleted`);

            // Step 2/4: EcoTaxa project
            await this.deleteEcoTaxaProject(project, ecotaxa, log, warnings);
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 75, "Step 2/4 EcoTaxa project : done");

            // Step 3/4: the past tasks of the project and their files
            const tasks_removed = await this.removeProjectTasks(project_id, task_id, log, warnings);
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 85, `Step 3/4 tasks : done, ${tasks_removed} task(s) removed`);

            // Step 4/4: the project itself. This task would go with its row (ON DELETE CASCADE): it leaves the project first.
            await this.taskRepository.detachTaskFromProject(task_id);
            await log(`Step 4/4 project : this task no longer refers to project ${project_id}, it outlives it`);
            const deleted_rows = await this.projectRepository.deleteProject({ project_id: project_id });
            if (deleted_rows === 0) {
                throw new Error("Cannot delete project");
            }
            await log(`Step 4/4 project : database row of project ${project_id} deleted, its privileges went with it`);
            const storage_removed = await this.projectRepository.deleteProjectStorage(project_id);
            await log(storage_removed
                ? `Step 4/4 project : storage folder ${project_id}/ removed`
                : `Step 4/4 project : no storage folder ${project_id}/ to remove`);
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 99, "Step 4/4 project : done");

            const warning_summary = warnings.length > 0 ? `. WARNING ${warnings.join(" | ")}` : "";
            await this.taskRepository.finishTask({ task_id: task_id }, `Project ${project_id} "${project.project_title}" deleted : ${samples.length} sample(s), ${tasks_removed} task(s)${warning_summary}`);
        } catch (error) {
            if ((error as Error).message === TASK_CANCELLED_MESSAGE) {
                await log(`Deletion stopped : ${samples_deleted} of ${samples_total} sample(s) deleted, the project and its remaining samples are kept`);
            }
            await this.taskRepository.failedTask(task_id, error as Error);
        }
    }

    private async getProjectSamples(project_id: number): Promise<PublicSampleModel[]> {
        const options: PreparedSearchOptions = {
            filter: [{ field: "project_id", operator: "=", value: project_id }],
            sort_by: [],
            page: 1,
            limit: 10000000
        }
        const result = await this.sampleRepository.standardGetSamples(options);
        return result.items;
    }

    // A failure here does not keep the project: it is reported, the EcoTaxa project stays to be deleted by hand.
    private async deleteEcoTaxaProject(project: ProjectResponseModel, ecotaxa: EcoTaxaCleanup | null, log: TaskLogger, warnings: string[]): Promise<void> {
        if (!isLinkedToEcoTaxa(project)) {
            await log("Step 2/4 EcoTaxa project : none linked, skipped");
            return;
        }
        if (!ecotaxa) {
            const reason = `EcoTaxa project ${project.ecotaxa_project_id} kept on instance ${project.ecotaxa_instance_id}, no account to delete it`;
            warnings.push(reason);
            await log(`Step 2/4 EcoTaxa project : WARNING ${reason}`);
            return;
        }
        try {
            await this.ecotaxaAccountRepository.api_delete_ecotaxa_project(ecotaxa.base_url, ecotaxa.token, ecotaxa.ecotaxa_project_id);
            await log(`Step 2/4 EcoTaxa project : project ${ecotaxa.ecotaxa_project_id} deleted on ${ecotaxa.instance_name}`);
        } catch (error) {
            const reason = `EcoTaxa project ${ecotaxa.ecotaxa_project_id} not deleted on ${ecotaxa.instance_name} (${(error as Error).message})`;
            warnings.push(reason);
            await log(`Step 2/4 EcoTaxa project : WARNING ${reason}`);
        }
    }

    // The task rows of the project would go with it, leaving their files behind: they are deleted the
    // regular way, files first. Returns the number of tasks removed.
    private async removeProjectTasks(project_id: number, current_task_id: number, log: TaskLogger, warnings: string[]): Promise<number> {
        const options: PreparedSearchOptions = {
            filter: [{ field: "task_project_id", operator: "=", value: project_id }],
            sort_by: [{ sort_by: "task_id", order_by: "asc" }],
            page: 1,
            limit: 10000000
        }
        const result = await this.taskRepository.standardGetTasks(options);
        const tasks = result.items.filter(t => t.task_id !== current_task_id);
        await log(`Step 3/4 tasks : ${tasks.length} past task(s) of the project to remove with their files`);
        let removed = 0;
        for (const past_task of tasks) {
            const label = `task ${past_task.task_id} (${past_task.task_type}, ${past_task.task_status})`;
            try {
                const deleted_rows = await this.taskRepository.deleteTask({ task_id: past_task.task_id });
                if (deleted_rows === 0) {
                    await log(`Step 3/4 tasks : ${label} already gone`);
                    continue;
                }
                removed++;
                await log(`Step 3/4 tasks : ${label} removed with its files`);
            } catch (error) {
                const reason = `${label} not removed (${(error as Error).message})`;
                warnings.push(reason);
                await log(`Step 3/4 tasks : WARNING ${reason}`);
            }
        }
        return removed;
    }
}
