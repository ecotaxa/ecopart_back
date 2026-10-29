
import { PublicHeaderSampleResponseModel, SampleParticleStats, SampleRequestCreationModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskLogger, TaskRepository } from "../../interfaces/repositories/task-repository";

import { ImportSamplesUseCase } from "../../interfaces/use-cases/sample/import-samples";
import { ProjectResponseModel } from "../../entities/project";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import path from "path";
import { describeUvp5PivotReport } from "../../utils/uvp5-pivot-converter";
import { cleanupLogPrefix } from "../../utils/task-cleanup";
import { binnedSampleSettingsOf } from "../export/binned-settings";
import { computeParticleStats, describeParticleStats, NO_PARTICLE_STATS } from "./particle-stats";

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

    async execute(current_user: UserUpdateModel, project_id: number, samples_names_to_import: string[], validated_samples: string[] = []): Promise<PublicTaskResponseModel> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to get the project importable samples
        await this.ensureUserCanGet(current_user, project_id);

        if (samples_names_to_import.length === 0) { throw new Error("No samples to import"); }

        // A sample listed twice would only be refused at step 4/4, by the database, after the copy.
        this.ensureNoSampleIsRepeated(samples_names_to_import);

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
        // Fire-and-forget: failures are recorded on the task inside; only a failure to record one (task deleted
        // meanwhile, database unavailable) reaches this catch, which keeps it from stopping the server.
        this.startImportTask(task, samples_names_to_import, project.instrument_model, project, current_user, validated_samples)
            .catch((error) => console.log(new Date().toISOString(), `Import task ${task.task_id} could not record its outcome`, error));

        return this.taskRepository.toPublicTask(task);
    }

    private ensureNoSampleIsRepeated(samples_names_to_import: string[]): void {
        const repeated = new Set(samples_names_to_import.filter((name, i) => samples_names_to_import.indexOf(name) !== i));
        if (repeated.size > 0) {
            throw new Error("Samples listed more than once: " + [...repeated].join(", "));
        }
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

    // Only the vignettes of the imported samples are counted: those of the others are not needed.
    private async listImportableSamples(project: ProjectResponseModel, samples_names_to_import: string[]): Promise<PublicHeaderSampleResponseModel[]> {
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        return await this.sampleRepository.listImportableSamples(project.root_folder_path, project.instrument_model, dest_folder, project.project_id, samples_names_to_import);
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
            importable_samples = await this.listImportableSamples(project, samples_names_to_import);
            // Check that asked samples are in the importable list of samples
            await this.ensureSamplesAreImportables(importable_samples, samples_names_to_import, task_id, log, project);

            await this.taskRepository.throwIfCancelled(task_id);

            // 2/4 Copy source files to hiden project folder 
            await this.copySourcesToProjectFolder(task_id, log, samples_names_to_import, instrument_model, project);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error);
            return;
        }
        try {
            // From here on, a cancellation removes the copied sources in the catch below
            await this.taskRepository.throwIfCancelled(task_id);

            // 3/4 Build the UVP5 pivots
            const vignette_count_map = new Map(importable_samples.map(s => [s.sample_name, s.vignette_number]));
            const formated_samples = await this.buildPivots(task_id, log, project, current_user.user_id, samples_names_to_import, vignette_count_map);
            await this.computeParticleStats(task_id, log, project, formated_samples);

            // Last checkpoint: once the samples exist in the database the import completes
            await this.taskRepository.throwIfCancelled(task_id);

            // 4/4 Create samples
            await this.importSamples(task_id, log, project, current_user.user_id, samples_names_to_import, formated_samples, validated_samples);

            // finish task
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            await this.deleteSourcesFromProjectFolder(task, samples_names_to_import, project, error);
            await this.taskRepository.failedTask(task_id, error);
        }
    }
    async ensureSamplesAreImportables(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[], task_id: number, log: TaskLogger, project: ProjectResponseModel) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 10, "Step 1/4 sample validation : start");
        await this.ensureSamplesAreBothInHeadersAndInDataFolder(samples, samples_names_to_import, project);
        this.ensureSamplesPassQcLvl1(samples, samples_names_to_import);
        await log(`Step 1/4 sample validation : ${samples_names_to_import.length} sample(s) to import out of ${samples.length} importable`);
        await this.ensureWorkFilesArePresent(task_id, log, project, samples_names_to_import);
        await this.ensureDepthProfilesHavePressure(project, samples_names_to_import);
        //TODO LATER add more validation
        const samples_by_name = new Map(samples.map(sample => [sample.sample_name, sample]));
        for (const sample_name of samples_names_to_import) {
            const sample = samples_by_name.get(sample_name);
            if (!sample) continue;
            await log(`Step 1/4 sample validation : ${sample_name} : raw file ${sample.raw_file_name}, images [${sample.first_image}, ${sample.last_image}], ${sample.vignette_number} vignettes`);
        }
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 20, "Step 1/4 sample validation : done");

    }

    async ensureSamplesAreBothInHeadersAndInDataFolder(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[], project: ProjectResponseModel) {
        const samples_names_set = new Set(samples.map(sample => sample.sample_name));

        const missing_samples = samples_names_to_import.filter(sample_id => !samples_names_set.has(sample_id));

        if (missing_samples.length > 0) {
            const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
            const reasons = await this.sampleRepository.explainNotImportableSamples(project.root_folder_path, dest_folder, project.project_id, missing_samples);
            throw new Error("Samples not importable: " + missing_samples.map(name => `${name} (${reasons.get(name)})`).join(", "));
        }
    }

    ensureSamplesPassQcLvl1(samples: PublicHeaderSampleResponseModel[], samples_names_to_import: string[]) {
        const samples_by_name = new Map(samples.map(sample => [sample.sample_name, sample]));
        const failing_samples = samples_names_to_import
            .map(name => samples_by_name.get(name))
            .filter((sample): sample is PublicHeaderSampleResponseModel => sample !== undefined && !sample.qc_lvl1);
        if (failing_samples.length > 0) {
            throw new Error("Samples failed QC level 1 (source data missing): " + failing_samples.map(sample => `${sample.sample_name} (${sample.qc_lvl1_comment})`).join(", "));
        }
    }

    // UVP5: steps 3/4 and the pivot read the datfile, HDR*.txt and the .bru from the copy of the work
    // entry, and the copy of a tar.zst takes hours on a long deployment: they are looked for first,
    // in every sample, so that all the incomplete samples are reported at once.
    async ensureWorkFilesArePresent(task_id: number, log: TaskLogger, project: ProjectResponseModel, samples_names_to_import: string[]): Promise<void> {
        if (!project.instrument_model.startsWith('UVP5')) return;
        const incomplete: string[] = [];
        for (const sample_name of samples_names_to_import) {
            await this.taskRepository.throwIfCancelled(task_id);
            let reason: string | null;
            try {
                const check = await this.sampleRepository.checkUvp5WorkFiles(project.root_folder_path, sample_name);
                const source = `${check.work_source} (${check.files_count} files)`;
                reason = check.missing.length > 0 ? `${source} has no ${check.missing.join(", ")}` : null;
                await log(`Step 1/4 sample validation : ${sample_name} : ${reason ?? `work files found in ${source}`}`);
            } catch (error) {
                reason = `its work entry cannot be read: ${(error as Error).message}`;
                await log(`Step 1/4 sample validation : ${sample_name} : ${reason}`);
            }
            if (reason !== null) incomplete.push(`${sample_name} (${reason})`);
        }
        if (incomplete.length > 0) {
            throw new Error("Samples with missing work files: " + incomplete.join(", ") + ". Only the work entry of each sample is read: add the files there, then relaunch the import.");
        }
    }

    // A particle file without any readable pressure gives a NULL max_pressure. A time series is
    // still placed by its time, a depth profile cannot be placed at all: refuse it before the copy.
    async ensureDepthProfilesHavePressure(project: ProjectResponseModel, samples_names_to_import: string[]): Promise<void> {
        const without_pressure: string[] = [];
        for (const sample_name of samples_names_to_import) {
            const { sample_type_label } = await this.sampleRepository.getSourceFilterMetadata(project.root_folder_path, sample_name, project.instrument_model);
            if (sample_type_label !== "Depth") continue;
            const max_pressure = await this.sampleRepository.getSourceMaxPressure(project.root_folder_path, sample_name, project.instrument_model);
            if (max_pressure === null) without_pressure.push(sample_name);
        }
        if (without_pressure.length > 0) {
            throw new Error("Depth profiles without any readable pressure: " + without_pressure.join(", ") + ". Check the pressure column of their particle file (UVP6 particules.csv, UVP5 datfile), or declare them as time series.");
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

    // Removes the copies made at step 2/4. Never throws: a failing removal is logged with what may be
    // left behind, and the task still reaches its final status. The folder of a sample that exists in
    // the database is kept: those are its files, whether another import running at the same time
    // created it or this one did before failing.
    async deleteSourcesFromProjectFolder(task: TaskResponseModel, samples_names_to_import: string[], project: ProjectResponseModel, error: unknown) {
        const prefix = cleanupLogPrefix(error);
        const log: TaskLogger = (message) => this.taskRepository.logMessage(task.task_log_file_path, `${prefix} : ${message}`).catch(() => undefined);
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);

        await log(`removing the copies of ${samples_names_to_import.length} sample(s) from ${dest_folder} : ${samples_names_to_import.join(", ")}`);
        try {
            const created: string[] = [];
            for (const sample_name of samples_names_to_import) {
                if (await this.sampleRepository.getSample({ sample_name, project_id: project.project_id })) created.push(sample_name);
            }
            if (created.length > 0) await log(`kept the copies of ${created.length} sample(s) that exist in the database : ${created.join(", ")}`);
            const uncreated = samples_names_to_import.filter(name => !created.includes(name));
            if (uncreated.length === 0) return;
            const removed = await this.sampleRepository.deleteSamplesFromImportFolder(dest_folder, uncreated);
            await log(removed.length > 0 ? `removed ${removed.join(", ")}` : "nothing removed, no copy found");
        } catch (cleanup_error) {
            await log(`removal failed, copies may remain in ${dest_folder} : ${(cleanup_error as Error).message}`);
        }
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
            await this.taskRepository.throwIfCancelled(task_id);
            const report = await this.sampleRepository.generateUvp5Pivot(project.project_id, sample, project.instrument_model, project.root_folder_path);
            const progress = 55 + Math.round(((i + 1) / formated_samples.length) * 15);
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, "Step 3/4 pivot construction : " + describeUvp5PivotReport(report));
        }
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 70, "Step 3/4 pivot construction : done");
        return formated_samples;
    }

    // Particle statistics of every sample, read from its pivot (built above, or the UVP6 particules.zip
    // itself), one sample at a time so that a single pivot is held in memory. A pivot that cannot be
    // read leaves them NULL, for the COMPUTE_PARTICLE_STATS task to fill later: the import goes on.
    async computeParticleStats(task_id: number, log: TaskLogger, project: ProjectResponseModel, formated_samples: SampleRequestCreationModel[]): Promise<void> {
        const sample_type_labels = new Map<number, string>();
        for (const [i, sample] of formated_samples.entries()) {
            await this.taskRepository.throwIfCancelled(task_id);
            let stats: SampleParticleStats;
            try {
                const sample_type_label = await this.sampleTypeLabel(sample.sample_type_id, sample_type_labels);
                const pivot = await this.sampleRepository.getPivotImages(project.project_id, sample.sample_name, project.instrument_model);
                stats = await computeParticleStats(binnedSampleSettingsOf({ ...sample, sample_type_label }, project), pivot);
            } catch (error) {
                Object.assign(sample, NO_PARTICLE_STATS);
                await log(`Step 3/4 particle statistics : ${sample.sample_name} : WARNING particle statistics not computed, left empty (${(error as Error).message})`);
                continue;
            }
            Object.assign(sample, stats);
            const progress = 70 + Math.round(((i + 1) / formated_samples.length) * 4);
            await this.taskRepository.updateTaskProgress({ task_id: task_id }, progress, "Step 3/4 particle statistics : " + describeParticleStats(sample.sample_name, stats));
        }
    }

    private async sampleTypeLabel(sample_type_id: number, known: Map<number, string>): Promise<string> {
        const cached = known.get(sample_type_id);
        if (cached !== undefined) return cached;
        const sample_type = await this.sampleRepository.getSampleType({ sample_type_id: sample_type_id });
        if (!sample_type) throw new Error("Sample type not found");
        known.set(sample_type_id, sample_type.sample_type_label);
        return sample_type.sample_type_label;
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
                    project.instrument_model,
                    project.root_folder_path
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