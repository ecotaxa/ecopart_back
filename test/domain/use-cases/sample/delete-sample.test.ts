import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { TaskType } from "../../../../src/domain/entities/task";
import { EcotaxaAccountRepository } from "../../../../src/domain/interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { DeleteSample } from "../../../../src/domain/use-cases/sample/delete-sample";
import { projectResponseModel } from "../../../entities/project";
import { sampleModel_1, sampleModel_2 } from "../../../entities/sample";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { ecotaxa_instance_1, ecotaxaAccountResponseModel } from "../../../entities/user";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockEcotaxaAccountRepository: EcotaxaAccountRepository;
let mockProjectRepository: ProjectRepository;
let mockTaskRepository: TaskRepository;
let deleteSample: DeleteSample;

const current_user = { user_id: 1 };
const project = { ...projectResponseModel, project_id: sampleModel_1.project_id };
const linked_project = { ...project, ecotaxa_project_id: 456, ecotaxa_instance_id: ecotaxa_instance_1.ecotaxa_instance_id };
const sample_a: PublicSampleModel = sampleModel_1;
const sample_b: PublicSampleModel = { ...sampleModel_2, project_id: sampleModel_1.project_id };
const imported_sample: PublicSampleModel = { ...sample_a, ecotaxa_sample_imported: true };
const task = { ...TaskResponseModel_1, task_project_id: project.project_id };
const task_ref = { task_id: task.task_id };

function allowUser(): void {
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValue(true);
}

function knownSamples(...samples: PublicSampleModel[]): void {
    jest.spyOn(mockSampleRepository, "getSample").mockImplementation((request) =>
        Promise.resolve(samples.find(s => s.sample_id === request.sample_id) ?? null));
}

function ecotaxaAvailable(): void {
    jest.spyOn(mockEcotaxaAccountRepository, "getOneEcoTaxaInstance").mockResolvedValue(ecotaxa_instance_1);
    jest.spyOn(mockEcotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockResolvedValue(ecotaxaAccountResponseModel);
    jest.spyOn(mockEcotaxaAccountRepository, "api_ecotaxa_query_objects_by_sample").mockResolvedValue([10, 11]);
    jest.spyOn(mockEcotaxaAccountRepository, "api_ecotaxa_delete_objects").mockResolvedValue();
    jest.spyOn(mockSampleRepository, "deleteEcoTaxaSamplesFromDb").mockResolvedValue(1);
}

function runTask(project_of_samples: typeof project, samples: PublicSampleModel[]): Promise<void> {
    return (deleteSample as any).startDeleteSamplesTask(task, project_of_samples, samples);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockSampleRepository = new MockSampleRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
    mockProjectRepository = new MockProjectRepository();
    mockTaskRepository = new MockTaskRepository();
    deleteSample = new DeleteSample(mockUserRepository, mockSampleRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, mockProjectRepository, mockTaskRepository);
    // Defaults: a task that is never cancelled, whose log is written, returned without its log file path
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask);
});

describe("DeleteSample", () => {
    describe("before the task", () => {
        test("rejects a user who cannot be used", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            jest.spyOn(mockUserRepository, "isAdmin");

            await expect(deleteSample.execute(current_user, project.project_id, [sample_a.sample_id])).rejects.toThrow("User cannot be used");
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        });

        test("rejects a user who is neither admin nor manager of the project", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
            jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValue(false);
            jest.spyOn(mockProjectRepository, "getProject");

            await expect(deleteSample.execute(current_user, project.project_id, [sample_a.sample_id])).rejects.toThrow("Logged user cannot delete samples in this project");
            expect(mockPrivilegeRepository.isManager).toBeCalledWith({ user_id: current_user.user_id, project_id: project.project_id });
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
        });

        test("rejects an unknown project", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(null);

            await expect(deleteSample.execute(current_user, project.project_id, [sample_a.sample_id])).rejects.toThrow("Cannot find project");
        });

        test("rejects an unknown sample without creating a task", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            knownSamples(sample_a);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive");

            await expect(deleteSample.execute(current_user, project.project_id, [sample_a.sample_id, 999])).rejects.toThrow("Cannot find sample to delete");
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0);
        });

        test("rejects a sample of another project", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            knownSamples(sampleModel_2);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive");

            await expect(deleteSample.execute(current_user, project.project_id, [sampleModel_2.sample_id])).rejects.toThrow("The given project_id does not match the sample's project_id");
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0);
        });

        test("rejects an empty list", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            jest.spyOn(mockSampleRepository, "getSample");

            await expect(deleteSample.execute(current_user, project.project_id, [])).rejects.toThrow("No samples to delete");
            expect(mockSampleRepository.getSample).toBeCalledTimes(0);
        });

        test("refuses while the project is being deleted", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            knownSamples(sample_a);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockResolvedValue(null);

            await expect(deleteSample.execute(current_user, project.project_id, [sample_a.sample_id])).rejects.toThrow("The project is being deleted");
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith(expect.objectContaining({ task_type: TaskType.Delete_Sample }), [TaskType.Delete_Project]);
        });

        test("creates one DELETE_SAMPLE task for the samples, each once, and returns it", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project);
            knownSamples(sample_a, sample_b);
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockResolvedValue(task.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(task);
            const start = jest.spyOn(deleteSample as any, "startDeleteSamplesTask").mockResolvedValue(undefined);

            const created = await deleteSample.execute(current_user, project.project_id, [sample_a.sample_id, sample_b.sample_id, sample_a.sample_id]);

            expect(created).toEqual(toPublicTask(task));
            expect(mockSampleRepository.getSample).toBeCalledTimes(2);
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith({
                task_type: TaskType.Delete_Sample,
                task_status: "PENDING",
                task_owner_id: current_user.user_id,
                task_project_id: project.project_id,
                task_params: { sample_ids: [sample_a.sample_id, sample_b.sample_id], sample_names: [sample_a.sample_name, sample_b.sample_name] },
            }, [TaskType.Delete_Project]);
            expect(start).toBeCalledWith(task, project, [sample_a, sample_b]);
        });
    });

    describe("the task", () => {
        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "deleteSample").mockResolvedValue(1);
            jest.spyOn(mockSampleRepository, "deleteSampleFromStorage").mockResolvedValue(1);
        });

        test("deletes a sample never imported to EcoTaxa, without calling EcoTaxa", async () => {
            jest.spyOn(mockEcotaxaAccountRepository, "getOneEcoTaxaInstance");

            await runTask(linked_project, [sample_a]);

            expect(mockEcotaxaAccountRepository.getOneEcoTaxaInstance).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: sample_a.sample_id });
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledWith(sample_a.sample_name, project.project_id);
            expect(mockTaskRepository.updateTaskProgress).toBeCalledWith(task_ref, 99, `${sample_a.sample_name} deleted (1/1)`);
            expect(mockTaskRepository.finishTask).toBeCalledWith(task_ref, `1 sample(s) deleted from project ${project.project_id}`);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("deletes the EcoTaxa objects of an imported sample before the sample", async () => {
            ecotaxaAvailable();

            await runTask(linked_project, [imported_sample]);

            expect(mockEcotaxaAccountRepository.api_ecotaxa_query_objects_by_sample).toBeCalledWith(ecotaxa_instance_1.ecotaxa_instance_url, ecotaxaAccountResponseModel.ecotaxa_account_token, 456, [imported_sample.sample_name]);
            expect(mockEcotaxaAccountRepository.api_ecotaxa_delete_objects).toBeCalledWith(ecotaxa_instance_1.ecotaxa_instance_url, ecotaxaAccountResponseModel.ecotaxa_account_token, [10, 11]);
            expect(mockSampleRepository.deleteEcoTaxaSamplesFromDb).toBeCalledWith([imported_sample]);
            const objects_deleted = (mockEcotaxaAccountRepository.api_ecotaxa_delete_objects as jest.Mock).mock.invocationCallOrder[0];
            const row_deleted = (mockSampleRepository.deleteSample as jest.Mock).mock.invocationCallOrder[0];
            expect(objects_deleted).toBeLessThan(row_deleted);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("keeps a sample whose EcoTaxa objects cannot be deleted, deletes the others, then fails the task", async () => {
            ecotaxaAvailable();
            jest.spyOn(mockEcotaxaAccountRepository, "api_ecotaxa_query_objects_by_sample").mockRejectedValue(new Error("EcoTaxa down"));

            await runTask(linked_project, [imported_sample, sample_b]);

            expect(mockSampleRepository.deleteSample).toBeCalledTimes(1);
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: sample_b.sample_id });
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(task.task_id,
                new Error(`Deletion failed for 1 of 2 sample(s). ${imported_sample.sample_name} : EcoTaxa objects not deleted from project 456 on ${ecotaxa_instance_1.ecotaxa_instance_name} (EcoTaxa down), the sample is kept`));
        });

        test("deletes an imported sample on EcoPart only when no generic account can act on EcoTaxa", async () => {
            ecotaxaAvailable();
            jest.spyOn(mockEcotaxaAccountRepository, "getEcotaxaGenericAccountForInstance").mockRejectedValue(new Error("No generic account"));

            await runTask(linked_project, [imported_sample]);

            expect(mockEcotaxaAccountRepository.api_ecotaxa_query_objects_by_sample).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: imported_sample.sample_id });
            expect(mockTaskRepository.logMessage).toBeCalledWith(task.task_log_file_path, `${imported_sample.sample_name} (id ${imported_sample.sample_id}) : imported to EcoTaxa, its EcoTaxa objects are kept`);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("a cancellation stops before the next sample, the samples already deleted stay deleted", async () => {
            const cancelled = new Error(TASK_CANCELLED_MESSAGE);
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockRejectedValue(cancelled);

            await runTask(project, [sample_a, sample_b]);

            expect(mockSampleRepository.deleteSample).toBeCalledTimes(1);
            expect(mockSampleRepository.deleteSample).toBeCalledWith({ sample_id: sample_a.sample_id });
            expect(mockTaskRepository.logMessage).toBeCalledWith(task.task_log_file_path, "Deletion stopped : 1 of 2 sample(s) deleted, the others are kept");
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(task.task_id, cancelled);
        });

        test("goes on after a sample whose row cannot be deleted, then fails the task listing it", async () => {
            jest.spyOn(mockSampleRepository, "deleteSample").mockResolvedValueOnce(0).mockResolvedValueOnce(1);

            await runTask(project, [sample_a, sample_b]);

            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledTimes(1);
            expect(mockSampleRepository.deleteSampleFromStorage).toBeCalledWith(sample_b.sample_name, project.project_id);
            expect(mockTaskRepository.updateTaskProgress).toBeCalledWith(task_ref, 50, `${sample_a.sample_name} not deleted : Cannot delete sample`);
            expect(mockTaskRepository.failedTask).toBeCalledWith(task.task_id, new Error(`Deletion failed for 1 of 2 sample(s). ${sample_a.sample_name} : Cannot delete sample`));
        });
    });
});
