
import { PublicHeaderSampleResponseModel, SampleRequestCreationModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskLogger, TaskRepository } from "../../interfaces/repositories/task-repository";

import { ImportSamplesUseCase } from "../../interfaces/use-cases/sample/import-samples";
import { ProjectResponseModel } from "../../entities/project";
import { PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import path from "path";
import { describeUvp5PivotReport } from "../../utils/uvp5-pivot-converter";

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

    async execute(current_user: UserUpdateModel, project_id: number, samples_names_to_import: string[], validated_samples: string[] = []): Promise<TaskResponseModel> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to get the project importable samples
        await this.ensureUserCanGet(current_user, project_id);

        // Samples pre-validated via the QC preview must be part of the imported set.
        this.ensureValidatedSamplesAreImported(samples_names_to_import, validated_samples);

        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        // create a task to import samples
        const task_id = await this.createImportSamplesTask(current_user, project, samples_names_to_import);

        // get the task
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // start the task
        this.startImportTask(task, samples_names_to_import, project.instrument_model, project, current_user, validated_samples);

        return task;
    }

    private ensureValidatedSamplesAreImported(samples_names_to_import: string[], validated_samples: string[]): void {
        const importable_set = new Set(samples_names_to_import);
        const invalid = validated_samples.filter((name) => !importable_set.has(name));
        if (invalid.length > 0) {
            throw new Error("Invalid validated_samples: " + invalid.join(", "));
        }
    }

    async createImportSamplesTask(current_user: UserUpdateModel, project: ProjectResponseModel, samples: string[]): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Import,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: { samples: samples }
        }
        return await this.taskRepository.createTask(task);
    }

    private async listImportableSamples(project: ProjectResponseModel): Promise<PublicHeaderSampleResponseModel[]> {
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const samples = await this.sampleRepository.listImportableSamples(project.root_folder_path, project.instrument_model, dest_folder, project.project_id);
        if (samples.length === 0) { throw new Error("No samples to import"); }

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

    private async startImportTask(task: TaskResponseModel, samples_names_to_import: string[], instrument_model: string, project: ProjectResponseModel, current_user: UserUpdateModel, validated_samples: string[] = []) {
        const task_id = task.task_id;
        const log: TaskLogger = (message) => this.taskRepository.logMessage(task.task_log_file_path, message);
        let importable_samples: PublicHeaderSampleResponseModel[] = [];
        try {
            await this.taskRepository.startTask({ task_id: task_id });

            // 1/4 Do validation before importing
            importable_samples = await this.listImportableSamples(project);
            // Check that asked samples are in the importable list of samples
            await this.ensureSamplesAreImportables(importable_samples, samples_names_to_import, task_id, log);

            // 2/4 Copy source files to hiden project folder 
            await this.copySourcesToProjectFolder(task_id, log, samples_names_to_import, instrument_model, project);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error);
            return;
        }
        try {
            // 3/4 Build the UVP5 pivots
            const vignette_count_map = new Map(importable_samples.map(s => [s.sample_name, s.vignette_number]));
            const formated_samples = await this.buildPivots(task_id, log, project, current_user.user_id, samples_names_to_import, vignette_count_map);

            // 4/4 Create samples
            await this.importSamples(task_id, log, project, current_user.user_id, samples_names_to_import, formated_samples, validated_samples);

            // finish task
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            await this.deleteSourcesFromProjectFolder(task_id, samples_names_to_import, project);
            this.taskRepository.failedTask(task_id, error);
        }
    }
    async ensureSamplesAreImportables(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[], task_id: number, log: TaskLogger) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 10, "Step 1/4 sample validation : start");
        this.ensureSamplesAreBothInHeadersAndInDataFolder(samples, samples_names_to_import);
        this.ensureSamplesPassQcLvl1(samples, samples_names_to_import);
        //TODO LATER add more validation
        await log(`Step 1/4 sample validation : ${samples_names_to_import.length} sample(s) to import out of ${samples.length} importable`);
        const samples_by_name = new Map(samples.map(sample => [sample.sample_name, sample]));
        for (const sample_name of samples_names_to_import) {
            const sample = samples_by_name.get(sample_name);
            if (!sample) continue;
            await log(`Step 1/4 sample validation : ${sample_name} : raw file ${sample.raw_file_name}, images [${sample.first_image}, ${sample.last_image}], ${sample.vignette_number} vignettes`);
        }
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 20, "Step 1/4 sample validation : done");

    }

    ensureSamplesAreBothInHeadersAndInDataFolder(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[]) {
        const samples_names_set = new Set(samples.map(sample => sample.sample_name));

        const missing_samples = samples_names_to_import.filter(sample_id => !samples_names_set.has(sample_id));

        if (missing_samples.length > 0) {
            throw new Error("Samples not importable: " + missing_samples.join(", "));
        }
    }

    ensureSamplesPassQcLvl1(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[]) {
        const samples_by_name = new Map(samples.map(sample => [sample.sample_name, sample]));
        const failing_samples = samples_names_to_import.filter(name => {
            const sample = samples_by_name.get(name);
            return sample && !sample.qc_lvl1;
        });
        if (failing_samples.length > 0) {
            throw new Error("Samples failed QC level 1 (source data missing): " + failing_samples.join(", "));
        }
    }

    async copySourcesToProjectFolder(task_id: number, log: TaskLogger, samples_names_to_import: string[], instrument_model: string, project: ProjectResponseModel) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 25, "Step 2/4 sample folders copy : start");

        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const root_folder_path = project.root_folder_path;
        const copy_log: TaskLogger = (message) => log("Step 2/4 sample folders copy : " + message);
        let source_folder;

        if (instrument_model.startsWith('UVP6')) {
            source_folder = path.join(root_folder_path, 'ecodata');
            await this.sampleRepository.UVP6copySamplesToImportFolder(source_folder, dest_folder, samples_names_to_import, copy_log);
        } else if (instrument_model.startsWith('UVP5')) {
            await this.sampleRepository.UVP5copySamplesToImportFolder(root_folder_path, dest_folder, samples_names_to_import, copy_log);
        } else {
            throw new Error("Unknown instrument model");
        }
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 50, "Step 2/4 sample folders copy : done");
    }

    async deleteSourcesFromProjectFolder(task_id: number, samples_names_to_import: string[], project: ProjectResponseModel) {
        // Delete sources files from project folder
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        await this.sampleRepository.deleteSamplesFromImportFolder(dest_folder, samples_names_to_import);
        // Log the action
        const task_file_path = await this.taskRepository.getTask({ task_id });
        if (!task_file_path) {
            throw new Error("Cannot find task");
        }
        await this.taskRepository.logMessage(task_file_path.task_log_file_path, "Samples import failed, sources files deleted for samples: " + samples_names_to_import.join(", "));
    }

    // A UVP5 sample is created only once its UVP6 pivot exists: every computed product reads the
    // pivot, so a conversion failure fails the import. The pivot needs the sample metadata (window,
    // aa, exp…), so it is read here; step 4/4 creates the samples from it.
    async buildPivots(task_id: number, log: TaskLogger, project: ProjectResponseModel, current_user_id: number, samples_names_to_import: string[], vignette_count_map: Map<string, number> = new Map()): Promise<SampleRequestCreationModel[]> {
        const is_uvp5 = project.instrument_model.startsWith('UVP5');
        if (is_uvp5) await this.taskRepository.updateTaskProgress({ task_id: task_id }, 55, "Step 3/4 pivot construction : start");
        const formated_samples = await this.formatSamplesToImport(log, project, current_user_id, samples_names_to_import, vignette_count_map);
        if (!is_uvp5) {
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, 70, "Step 3/4 pivot construction : skipped, a UVP6 particules.zip is already in the pivot format");
            return formated_samples;
        }
        for (const [i, sample] of formated_samples.entries()) {
            const report = await this.sampleRepository.generateUvp5Pivot(project.project_id, sample, project.instrument_model);
            const progress = 55 + Math.round(((i + 1) / formated_samples.length) * 15);
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, "Step 3/4 pivot construction : " + describeUvp5PivotReport(report));
        }
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 70, "Step 3/4 pivot construction : done");
        return formated_samples;
    }

    private async formatSamplesToImport(log: TaskLogger, project: ProjectResponseModel, current_user_id: number, samples_names_to_import: string[], vignette_count_map: Map<string, number>): Promise<SampleRequestCreationModel[]> {
        // Common sample data
        const base_sample: Partial<SampleRequestCreationModel> = {
            project_id: project.project_id,
            visual_qc_validator_user_id: current_user_id
        }
        // nb_black is a UVP6-only count of rows in particules.csv where the light flag is "0:1"
        // (lights off = noise reference). UVP5 doesn't acquire black/dark frames — the column
        // is always 0 on UVP5 samples by design (not a TODO).
        const fs_storage_project_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        const is_uvp6 = project.instrument_model.startsWith('UVP6');
        return await Promise.all(
            samples_names_to_import.map(async (sample_name) => {
                const sample = await this.sampleRepository.formatSampleToImport(
                    { ...base_sample, sample_name: sample_name },
                    project.instrument_model
                );
                sample.nb_vignettes = vignette_count_map.get(sample_name) ?? 0;
                if (is_uvp6) {
                    try {
                        sample.nb_black = await this.sampleRepository.countBlackParticulesUvp6(fs_storage_project_folder, sample_name);
                    } catch (error) {
                        // particules.csv missing or unreadable — leave nb_black at 0 rather than fail the whole import.
                        sample.nb_black = 0;
                        await log(`Step 3/4 pivot construction : ${sample_name} : WARNING black frames not counted, nb_black set to 0 (${error.message})`);
                    }
                } else {
                    sample.nb_black = 0;
                }
                return sample;
            })
        );
    }

    async importSamples(task_id: number, log: TaskLogger, project: ProjectResponseModel, current_user_id: number, samples_names_to_import: string[], formated_samples: SampleRequestCreationModel[], validated_samples: string[] = []): Promise<number[]> {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 75, "Step 4/4 samples db creation : start");

        // Create samples
        const created_samples_ids = await this.sampleRepository.createManySamples(formated_samples);
        for (const [i, sample_name] of samples_names_to_import.entries()) {
            await log(`Step 4/4 samples db creation : ${sample_name} created (sample_id ${created_samples_ids[i]})`);
        }

        // Mark the pre-validated samples VALIDATED (verified via the pre-import QC preview).
        await this.markSamplesValidatedAtImport(log, samples_names_to_import, created_samples_ids, validated_samples, current_user_id);

        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 100, "Step 4/4 samples db creation done");
        return created_samples_ids;
    }

    // createManySamples returns ids in the same order as the input names, so we zip names→ids by
    // index and flip each validated sample to VALIDATED via the shared visual-QC write path
    // (so the audit fields — validator, timestamp, comment — are set exactly as a manual review).
    private async markSamplesValidatedAtImport(log: TaskLogger, samples_names_to_import: string[], created_samples_ids: number[], validated_samples: string[], current_user_id: number): Promise<void> {
        if (!validated_samples || validated_samples.length === 0) return;

        const status = await this.sampleRepository.getVisualQCStatus({ visual_qc_status_label: "VALIDATED" });
        if (!status) throw new Error("Visual QC status not found");

        const name_to_id = new Map(samples_names_to_import.map((name, i) => [name, created_samples_ids[i]]));
        const validated_at = new Date().toISOString();
        for (const sample_name of validated_samples) {
            const sample_id = name_to_id.get(sample_name);
            if (sample_id === undefined) continue;
            await this.sampleRepository.setSampleVisualQc(
                sample_id,
                status.visual_qc_status_id,
                current_user_id,
                "Validated at import (pre-import visual QC)",
                validated_at
            );
            await log(`Step 4/4 samples db creation : ${sample_name} (sample_id ${sample_id}) visual QC set to VALIDATED (pre-import visual QC)`);
        }
    }
}