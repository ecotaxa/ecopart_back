
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";

import { ImportEcoTaxaSamplesUseCase } from "../../interfaces/use-cases/ecotaxa_sample/import-ecotaxa-samples";

import { PublicImportableEcoTaxaSampleResponseModel, SampleUpdateModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel } from "../../entities/project";
import { PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";

import path from "path";
import { PreparedSearchOptions } from "../../entities/search";

export class ImportEcoTaxaSamples implements ImportEcoTaxaSamplesUseCase {
    sampleRepository: SampleRepository
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository
    taskRepository: TaskRepository
    ecotaxa_accountRepository: EcotaxaAccountRepository

    DATA_STORAGE_FS_STORAGE: string

    constructor(sampleRepository: SampleRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository, taskRepository: TaskRepository, ecotaxa_accountRepository: EcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE: string) {
        this.sampleRepository = sampleRepository
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
        this.taskRepository = taskRepository
        this.ecotaxa_accountRepository = ecotaxa_accountRepository
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
    }

    async execute(current_user: UserUpdateModel, project_id: number, samples_names_to_import: string[]): Promise<TaskResponseModel> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to get the project importable samples
        await this.ensureUserCanGet(current_user, project_id);

        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        // create a task to import ecotaxa samples
        const task_id = await this.createImportEcoTaxaSamplesTask(current_user, project, samples_names_to_import);

        // get the task
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // start the task
        this.startImportEcoTaxaSamplesTask(task, samples_names_to_import, project.instrument_model, project);

        return task;
    }

    async createImportEcoTaxaSamplesTask(current_user: UserUpdateModel, project: ProjectResponseModel, samples: string[]): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Import_EcoTaxa,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { samples: samples }
        }
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
            project_id: project_id
        });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot list importable EcoTaxa samples in this project");
        }
    }

    private async startImportEcoTaxaSamplesTask(task: TaskResponseModel, samples_names_to_import: string[], instrument_model: string, project: ProjectResponseModel) {
        const task_id = task.task_id;
        let importable_samples: PublicImportableEcoTaxaSampleResponseModel[] = [];
        try {
            await this.taskRepository.startTask({ task_id: task_id });

            // 1/5 Do validation before importing
            importable_samples = await this.listImportableEcoTaxaSamples(project);
            // Check that asked samples are in the importable list of samples
            await this.ensureEcoTaxaSamplesAreImportables(importable_samples, samples_names_to_import, task_id);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error);
            return;
        }
        try {
            // 3/5 generate qc report by samples
            //TODO LATER but we can already et the qc flag to un validated

            // 4/5 Create EcoTaxa Samples samples in db
            //filter importable_samples to keep only the ones to import
            const samples_to_import: PublicImportableEcoTaxaSampleResponseModel[] = importable_samples.filter(sample => samples_names_to_import.includes(sample.sample_name));

            await this.importEcoTaxaSamplesInDb(task_id, samples_to_import);

            // 5/5  import samples in ecotaxa
            //const ecotaxa_tasks_id = 
            await this.importEcoTaxaSamplesToEcotaxa(samples_to_import, project);
            //this.sampleRepository.updateEcoTaxaSamplesInDbWithEcotaxaInfo(samples_names_to_import, ecotaxa_tasks_id, task_id);
            // finish task
            await this.taskRepository.finishTask({ task_id: task_id });

        } catch (error) {
            console.error("Error during EcoTaxa samples import:", error);
            // rollback : delete created ecotaxa samples in db
            await this.deleteEcoTaxaSamplesFromDb(samples_names_to_import);
            this.taskRepository.failedTask(task_id, error);
            //todo abbort import in ecotaxa?
        }

    }
    async importEcoTaxaSamplesToEcotaxa(samples_to_import: PublicImportableEcoTaxaSampleResponseModel[], project: ProjectResponseModel) {
        await this.ecotaxa_accountRepository.importEcoTaxaSamplesInEcoTaxa(samples_to_import, project);
    }
    private async listImportableEcoTaxaSamples(project: ProjectResponseModel): Promise<PublicImportableEcoTaxaSampleResponseModel[]> {
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const samples = await this.sampleRepository.listImportableEcoTaxaSamples(project.instrument_model, dest_folder, project.project_id);
        if (samples.length === 0) { throw new Error("No samples to import"); }

        return samples;
    }
    async ensureEcoTaxaSamplesAreImportables(samples: PublicImportableEcoTaxaSampleResponseModel[], samples_names_to_import: string[], task_id: number) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 10, "Step 1/5 EcoTaxa sample validation : start");
        this.ensureEcoTaxaSamplesAreInImportableList(samples, samples_names_to_import);
        //TODO LATER add more validation
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 20, "Step 1/5 EcoTaxa sample validation : done");

    }

    ensureEcoTaxaSamplesAreInImportableList(samples: PublicImportableEcoTaxaSampleResponseModel[], samples_names_to_import: string[]) {
        const samples_names_set = new Set(samples.map(sample => sample.sample_name));

        const missing_samples = samples_names_to_import.filter(sample_id => !samples_names_set.has(sample_id));

        if (missing_samples.length > 0) {
            throw new Error("EcoTaxa samples not importable: " + missing_samples.join(", "));
        }
    }

    async deleteEcoTaxaSamplesFromDb(samples_names_to_import: string[]) {
        console.log("Deleting EcoTaxa samples from db for : ", samples_names_to_import);
        // update samples from db to empty ecotaxa related fields
        const options: PreparedSearchOptions = {
            filter: [
                { field: "sample_name", operator: "IN", value: samples_names_to_import },
                { field: "ecotaxa_sample_imported", operator: "=", value: true }
            ],
            sort_by: [],
            page: 1,
            limit: 1
        }
        const ecotaxa_samples = await this.sampleRepository.standardGetSamples(options);
        if (ecotaxa_samples.total === 0) {
            throw new Error("No EcoTaxa samples to delete");
        }
        // delete samples from db
        await this.sampleRepository.deleteEcoTaxaSamplesFromDb(ecotaxa_samples.items);
    }

    async importEcoTaxaSamplesInDb(task_id: number, samples_to_import: PublicImportableEcoTaxaSampleResponseModel[]): Promise<number> {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 75, "Step 4/5 EcoTaxa samples db creation : start");

        // Common EcoTaxa sample data
        // will be SET when calling ecotaxa api
        //ecotaxa_import_status_id: undefined,
        // ecotaxa_sample_id: undefined
        // ecotaxa_sample_task_id: undefined

        // Format EcoTaxa samples to import
        const formated_samples: SampleUpdateModel[] =
            samples_to_import.map((sample) => {
                return {
                    sample_id: sample.sample_id,

                    ecotaxa_sample_imported: true,
                    ecotaxa_sample_import_date: new Date().toISOString(),

                    ecotaxa_sample_nb_images: sample.images,
                    ecotaxa_sample_tsv_file_name: sample.tsv_file_name,
                    ecotaxa_sample_local_folder_tsv_path: sample.local_folder_tsv_path,
                };
            });

        // Create ecotaxa samples in db
        const nb_of_updated_samples = await this.sampleRepository.createManyEcoTaxaSamples(formated_samples);

        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 100, "Step 4/5 ecotaxa samples db creation done");
        return nb_of_updated_samples;
    }
}