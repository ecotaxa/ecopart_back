import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
import { ProjectResponseModel, ProjectUpdateModel } from "../../../../src/domain/entities/project";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { TaskType } from "../../../../src/domain/entities/task";
import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { DeleteProject } from "../../../../src/domain/use-cases/project/delete-project";
import { projectResponseModel } from "../../../entities/project";
import { sampleModel_1, sampleModel_2 } from "../../../entities/sample";
import { TaskResponseModel_1, TaskResponseModel_2, toPublicTask } from "../../../entities/task";
import { ecotaxa_instance_1, ecotaxaAccountResponseModel } from "../../../entities/user";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";

let mockUserRepository: UserRepository;
let mockProjectRepository: ProjectRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockSampleRepository: SampleRepository;
let mockEcotaxaAccountRepository: EcotaxaAccountRepository;
let mockTaskRepository: TaskRepository;
let deleteProject: DeleteProject;

const current_user = { user_id: 1 };
const project: ProjectResponseModel = projectResponseModel;
const project_to_delete: ProjectUpdateModel = { project_id: project.project_id };
const linked_project: ProjectResponseModel = { ...project, ecotaxa_project_id: 456, ecotaxa_instance_id: ecotaxa_instance_1.ecotaxa_instance_id };
const sample_a: PublicSampleModel = { ...sampleModel_1, project_id: project.project_id };
const imported_sample: PublicSampleModel = { ...sampleModel_2, project_id: project.project_id, ecotaxa_sample_imported: true };
const task = { ...TaskResponseModel_1, task_type: TaskType.Delete_Project, task_project_id: project.project_id };
const task_ref = { task_id: task.task_id };
const past_task = { ...TaskResponseModel_2, task_project_id: project.project_id };

function allowUser(): void {
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValue(true);
}

function callOrder(mock: unknown): number {
    return (mock as jest.Mock).mock.invocationCallOrder[0];
}

function runTask(project_to_run: ProjectResponseModel): Promise<void> {
    return (deleteProject as any).startDeleteProjectTask(task, project_to_run);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockProjectRepository = new MockProjectRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    mockSampleRepository = new MockSampleRepository();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
    mockTaskRepository = new MockTaskRepository();
    deleteProject = new DeleteProject(mockUserRepository, mockProjectRepository, mockPrivilegeRepository, mockSampleRepository, mockEcotaxaAccountRepository, mockTaskRepository);
    // Defaults: a task that is never cancelled, whose log is written, returned without its log file path
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask);
});

describe("DeleteProject", () => {
    describe("before the task", () => {
        test("rejects a user who cannot be used", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            jest.spyOn(mockProjectRepository, "getProject");

            await expect(deleteProject.execute(current_user, project_to_delete)).rejects.toThrow("User cannot be used");
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
        });

        test("rejects an unknown project", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(null);
            jest.spyOn(mockUserRepository, "isAdmin");

            await expect(deleteProject.execute(current_user, project_to_delete)).rejects.toThrow("Cannot find project to delete");
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        });

        test("rejects a user who is neither admin nor manager of the project", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
            jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValue(false);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive");

            await expect(deleteProject.execute(current_user, project_to_delete)).rejects.toThrow("Logged user cannot delete this project");
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0);
        });

        test("only the project id reaches the repositories, whatever other keys the caller sent", async () => {
            allowUser();
            // Extra keys would be ANDed into the WHERE clause and could select another project
            const request = { project_id: project.project_id, root_folder_path: "/another/project" } as ProjectUpdateModel;
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockResolvedValue(task.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(task);
            jest.spyOn(deleteProject as any, "startDeleteProjectTask").mockResolvedValue(undefined);

            await deleteProject.execute(current_user, request);

            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: project.project_id });
            expect(mockPrivilegeRepository.isManager).toBeCalledWith({ user_id: current_user.user_id, project_id: project.project_id });
        });

        test("refuses while any task is still running on the project", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockResolvedValue(null);

            await expect(deleteProject.execute(current_user, project_to_delete)).rejects.toThrow("A task is still running on this project");
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith(expect.objectContaining({ task_type: TaskType.Delete_Project }), Object.values(TaskType));
        });

        test("creates a DELETE_PROJECT task attached to the project and returns it", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockResolvedValue(task.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(task);
            const start = jest.spyOn(deleteProject as any, "startDeleteProjectTask").mockResolvedValue(undefined);

            const created = await deleteProject.execute(current_user, project_to_delete);

            expect(created).toEqual(toPublicTask(task));
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith({
                task_type: TaskType.Delete_Project,
                task_status: "PENDING",
                task_owner_id: current_user.user_id,
                task_project_id: project.project_id,
                task_params: { project_id: project.project_id, project_title: project.project_title },
            }, Object.values(TaskType));
            expect(start).toBeCalledWith(task, project);
        });
    });

    describe("the task", () => {
        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "standardGetTasks").mockResolvedValue({ items: [task, past_task], total: 2 });
            jest.spyOn(mockTaskRepository, "deleteTask").mockResolvedValue(1);
            jest.spyOn(mockTaskRepository, "detachTaskFromProject").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample_a, imported_sample], total: 2 });
            jest.spyOn(mockSampleRepository, "deleteSample").mockResolvedValue(1);
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage").mockResolvedValue(1);
            jest.spyOn(mockSampleRepository, "deleteEcoTaxaSamplesFromDb").mockResolvedValue(1);
            jest.spyOn(mockProjectRepository, "deleteProject").mockResolvedValue(1);
            jest.spyOn(mockProjectRepository, "deleteProjectStorage").mockResolvedValue(true);
            jest.spyOn(mockEcotaxaAccountRepository, "getOneEcoTaxaInstance").mockResolvedValue(ecotaxa_instance_1);
            jest.spyOn(mockEcotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockResolvedValue(ecotaxaAccountResponseModel);
            jest.spyOn(mockEcotaxaAccountRepository, "api_ecotaxa_query_objects_by_sample").mockResolvedValue([7]);
            jest.spyOn(mockEcotaxaAccountRepository, "api_ecotaxa_delete_objects").mockResolvedValue();
            jest.spyOn(mockEcotaxaAccountRepository, "api_delete_ecotaxa_project").mockResolvedValue();
        });

        test("deletes the samples, the EcoTaxa project, the past tasks, then the project row and folder, in that order", async () => {
            await runTask(linked_project);

            expect(mockSampleRepository.deleteSample).toBeCalledTimes(2);
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledWith(sample_a.sample_name, project.project_id);
            expect(mockEcotaxaAccountRepository.api_ecotaxa_query_objects_by_sample).toBeCalledTimes(1);
            expect(mockEcotaxaAccountRepository.api_ecotaxa_query_objects_by_sample).toBeCalledWith(ecotaxa_instance_1.ecotaxa_instance_url, ecotaxaAccountResponseModel.ecotaxa_account_token, 456, [imported_sample.sample_name]);
            expect(mockEcotaxaAccountRepository.api_ecotaxa_delete_objects).toBeCalledWith(ecotaxa_instance_1.ecotaxa_instance_url, ecotaxaAccountResponseModel.ecotaxa_account_token, [7]);
            expect(mockEcotaxaAccountRepository.api_delete_ecotaxa_project).toBeCalledWith(ecotaxa_instance_1.ecotaxa_instance_url, ecotaxaAccountResponseModel.ecotaxa_account_token, 456);
            // The past tasks of the project go, not the deletion task itself
            expect(mockTaskRepository.deleteTask).toBeCalledTimes(1);
            expect(mockTaskRepository.deleteTask).toBeCalledWith({ task_id: past_task.task_id });
            expect(mockTaskRepository.detachTaskFromProject).toBeCalledWith(task.task_id);
            expect(mockProjectRepository.deleteProject).toBeCalledWith({ project_id: project.project_id });
            expect(mockProjectRepository.deleteProjectStorage).toBeCalledWith(project.project_id);
            expect(callOrder(mockEcotaxaAccountRepository.api_delete_ecotaxa_project)).toBeGreaterThan(callOrder(mockSampleRepository.deleteSampleFromStorage));
            expect(callOrder(mockTaskRepository.deleteTask)).toBeGreaterThan(callOrder(mockEcotaxaAccountRepository.api_delete_ecotaxa_project));
            expect(callOrder(mockTaskRepository.detachTaskFromProject)).toBeGreaterThan(callOrder(mockTaskRepository.deleteTask));
            expect(callOrder(mockProjectRepository.deleteProject)).toBeGreaterThan(callOrder(mockTaskRepository.detachTaskFromProject));
            expect(mockTaskRepository.finishTask).toBeCalledWith(task_ref, `Project ${project.project_id} "${project.project_title}" deleted : 2 sample(s), 1 task(s)`);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("never calls EcoTaxa for a project that is not linked", async () => {
            await runTask(project);

            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledTimes(0);
            expect(mockEcotaxaAccountRepository.api_ecotaxa_query_objects_by_sample).toBeCalledTimes(0);
            expect(mockEcotaxaAccountRepository.api_delete_ecotaxa_project).toBeCalledTimes(0);
            expect(mockTaskRepository.logMessage).toBeCalledWith(task.task_log_file_path, `${imported_sample.sample_name} (id ${imported_sample.sample_id}) : imported to EcoTaxa, its EcoTaxa objects are kept`);
            expect(mockProjectRepository.deleteProject).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("keeps the project when a sample cannot be deleted, after trying the others", async () => {
            jest.spyOn(mockSampleRepository, "deleteSample").mockResolvedValueOnce(0).mockResolvedValueOnce(1);

            await runTask(project);

            expect(mockSampleRepository.deleteSample).toBeCalledTimes(2);
            expect(mockEcotaxaAccountRepository.api_delete_ecotaxa_project).toBeCalledTimes(0);
            expect(mockTaskRepository.deleteTask).toBeCalledTimes(0);
            expect(mockTaskRepository.detachTaskFromProject).toBeCalledTimes(0);
            expect(mockProjectRepository.deleteProject).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(task.task_id,
                new Error(`Project ${project.project_id} kept : deletion failed for 1 of 2 sample(s). ${sample_a.sample_name} : Cannot delete sample`));
        });

        test("deletes an imported sample on EcoPart anyway when its EcoTaxa objects cannot be deleted, and reports it", async () => {
            jest.spyOn(mockEcotaxaAccountRepository, "api_ecotaxa_query_objects_by_sample").mockRejectedValue(new Error("EcoTaxa down"));

            await runTask(linked_project);

            expect(mockSampleRepository.deleteSample).toBeCalledTimes(2);
            expect(mockProjectRepository.deleteProject).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledWith(task_ref,
                `Project ${project.project_id} "${project.project_title}" deleted : 2 sample(s), 1 task(s). WARNING ${imported_sample.sample_name} : EcoTaxa objects not deleted from project 456 on ${ecotaxa_instance_1.ecotaxa_instance_name} (EcoTaxa down)`);
        });

        test("goes on when the EcoTaxa project cannot be deleted, and reports it", async () => {
            jest.spyOn(mockEcotaxaAccountRepository, "api_delete_ecotaxa_project").mockRejectedValue(new Error("Forbidden"));

            await runTask(linked_project);

            expect(mockProjectRepository.deleteProject).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledWith(task_ref,
                `Project ${project.project_id} "${project.project_title}" deleted : 2 sample(s), 1 task(s). WARNING EcoTaxa project 456 not deleted on ${ecotaxa_instance_1.ecotaxa_instance_name} (Forbidden)`);
        });

        test("keeps the EcoTaxa project and objects when no generic account can act on EcoTaxa, and reports it", async () => {
            jest.spyOn(mockEcotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockRejectedValue(new Error("No generic account"));

            await runTask(linked_project);

            expect(mockEcotaxaAccountRepository.api_ecotaxa_query_objects_by_sample).toBeCalledTimes(0);
            expect(mockEcotaxaAccountRepository.api_delete_ecotaxa_project).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSample).toBeCalledTimes(2);
            expect(mockTaskRepository.finishTask).toBeCalledWith(task_ref,
                `Project ${project.project_id} "${project.project_title}" deleted : 2 sample(s), 1 task(s). WARNING EcoTaxa project 456 kept on instance ${ecotaxa_instance_1.ecotaxa_instance_id}, no account to delete it`);
        });

        test("reports a past task that cannot be removed, and still deletes the project", async () => {
            jest.spyOn(mockTaskRepository, "deleteTask").mockRejectedValue(new Error("Task 2 is still RUNNING: cancel it before deleting it."));

            await runTask(project);

            expect(mockProjectRepository.deleteProject).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledWith(task_ref,
                `Project ${project.project_id} "${project.project_title}" deleted : 2 sample(s), 0 task(s). WARNING task ${past_task.task_id} (${past_task.task_type}, ${past_task.task_status}) not removed (Task 2 is still RUNNING: cancel it before deleting it.)`);
        });

        test("a cancellation between two samples keeps the project and its remaining samples", async () => {
            const cancelled = new Error(TASK_CANCELLED_MESSAGE);
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockRejectedValue(cancelled);

            await runTask(project);

            expect(mockSampleRepository.deleteSample).toBeCalledTimes(1);
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: sample_a.sample_id });
            expect(mockProjectRepository.deleteProject).toBeCalledTimes(0);
            expect(mockTaskRepository.logMessage).toBeCalledWith(task.task_log_file_path, "Deletion stopped : 1 of 2 sample(s) deleted, the project and its remaining samples are kept");
            expect(mockTaskRepository.failedTask).toBeCalledWith(task.task_id, cancelled);
        });

        test("fails when the project row cannot be deleted, leaving its storage in place", async () => {
            jest.spyOn(mockProjectRepository, "deleteProject").mockResolvedValue(0);

            await runTask(project);

            expect(mockProjectRepository.deleteProjectStorage).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(task.task_id, new Error("Cannot delete project"));
        });
    });
});
