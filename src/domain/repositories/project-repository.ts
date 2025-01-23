
import { ProjectDataSource } from "../../data/interfaces/data-sources/project-data-source";
import { InstrumentModelResponseModel } from "../entities/instrument_model";
import { PublicPrivilege } from "../entities/privilege";
import { ProjectRequestCreationModel, ProjectRequestModel, ProjectUpdateModel, ProjectResponseModel, PublicProjectResponseModel, PublicProjectRequestCreationModel } from "../entities/project";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { ProjectRepository } from "../interfaces/repositories/project-repository";

import * as fsPromises from 'fs/promises'; // For promise-based file operations//import fs from 'fs'; // Correct import for `createReadStream`
import * as fs from 'fs'; // For createWriteStream

import archiver from 'archiver';

import path from "path";

export class ProjectRepositoryImpl implements ProjectRepository {
    projectDataSource: ProjectDataSource
    DATA_STORAGE_FS_STORAGE: string
    DATA_STORAGE_EXPORT: string
    DATA_STORAGE_FOLDER: string

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    base_folder = path.join(__dirname, '..', '..', '..');

    constructor(projectDataSource: ProjectDataSource, DATA_STORAGE_FS_STORAGE: string, DATA_STORAGE_EXPORT: string, DATA_STORAGE_FOLDER: string) {
        this.projectDataSource = projectDataSource
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
        this.DATA_STORAGE_EXPORT = DATA_STORAGE_EXPORT
        this.DATA_STORAGE_FOLDER = DATA_STORAGE_FOLDER
    }

    async createProject(project: ProjectRequestCreationModel): Promise<number> {
        const result = await this.projectDataSource.create(project)
        return result;
    }

    async getProject(project: ProjectRequestModel): Promise<ProjectResponseModel | null> {
        const result = await this.projectDataSource.getOne(project)
        return result;
    }

    // TODO REFACTOR RE THINK THIS
    computeDefaultDepthOffset(instrument_model: string): number | undefined {
        if (instrument_model === undefined) throw new Error("Instrument is required")
        if (instrument_model.startsWith("UVP5")) return 1.2
        else return undefined
    }

    async deleteProject(project: ProjectRequestModel): Promise<number> {
        const result = await this.projectDataSource.deleteOne(project)
        return result;
    }

    private async updateProject(project: ProjectUpdateModel, params: string[]): Promise<number> {
        const filteredProject: Partial<ProjectUpdateModel> = {};
        const unauthorizedParams: string[] = [];

        // Filter the project object based on authorized parameters
        Object.keys(project).forEach(key => {
            if (key === 'project_id') {
                filteredProject[key] = project[key];
            } else if (params.includes(key)) {
                filteredProject[key] = project[key];
            } else {
                unauthorizedParams.push(key);
            }
        });

        // If unauthorized params are found, throw an error
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }
        // If there are valid parameters, update the project
        if (Object.keys(filteredProject).length <= 1) {
            throw new Error('Please provide at least one valid parameter to update');
        }
        const updatedProjectCount = await this.projectDataSource.updateOne(filteredProject as ProjectUpdateModel);
        return updatedProjectCount;
    }

    async standardUpdateProject(project: ProjectUpdateModel): Promise<number> {
        const params_restricted = ["project_id", "root_folder_path", "project_title", "project_acronym", "project_description", "project_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number"]
        const updated_project_nb = await this.updateProject(project, params_restricted)
        return updated_project_nb
    }

    async standardGetProjects(options: PreparedSearchOptions): Promise<SearchResult<ProjectResponseModel>> {
        // Can be filtered by 
        const filter_params_restricted = ["project_id", "root_folder_path", "project_title", "project_acronym", "project_description", "project_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number", "project_creation_date"]

        // Can be sort_by 
        const sort_param_restricted = ["project_id", "root_folder_path", "project_title", "project_acronym", "project_description", "project_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number", "project_creation_date"]

        return await this.getProjects(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    //TODO MOVE TO SEARCH REPOSITORY
    private async getProjects(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<ProjectResponseModel>> {
        const unauthorizedParams: string[] = [];
        //TODO move to a search repository
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by => {
            let is_valid = true;
            if (!sort_by_params.includes(sort_by.sort_by)) {
                unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
                is_valid = false;
            }
            if (!order_by_params.includes(sort_by.order_by)) {
                unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter => {
            let is_valid = true;
            if (!filtering_params.includes(filter.field)) {
                unauthorizedParams.push(`Filter field: ${filter.field}`);
                is_valid = false;
            }
            if (!filter_operator_params.includes(filter.operator)) {
                unauthorizedParams.push(`Filter operator: ${filter.operator}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }

        return await this.projectDataSource.getAll(options);
    }

    formatProjectRequestCreationModel(public_project: PublicProjectRequestCreationModel, instrument: InstrumentModelResponseModel): ProjectRequestCreationModel {
        const project: ProjectRequestCreationModel = {
            root_folder_path: public_project.root_folder_path,
            project_title: public_project.project_title,
            project_acronym: public_project.project_acronym,
            project_description: public_project.project_description,
            project_information: public_project.project_information,
            cruise: public_project.cruise,
            ship: public_project.ship,
            data_owner_name: public_project.data_owner_name,
            data_owner_email: public_project.data_owner_email,
            operator_name: public_project.operator_name,
            operator_email: public_project.operator_email,
            chief_scientist_name: public_project.chief_scientist_name,
            chief_scientist_email: public_project.chief_scientist_email,
            override_depth_offset: public_project.override_depth_offset,
            enable_descent_filter: public_project.enable_descent_filter,
            privacy_duration: public_project.privacy_duration,
            visible_duration: public_project.visible_duration,
            public_duration: public_project.public_duration,
            instrument_model: instrument.instrument_model_id,
            serial_number: public_project.serial_number
        };
        return project;
    }

    toPublicProject(project: ProjectResponseModel, privileges: PublicPrivilege): PublicProjectResponseModel {

        const publicProject: PublicProjectResponseModel = {
            project_id: project.project_id,
            root_folder_path: project.root_folder_path,
            project_title: project.project_title,
            project_acronym: project.project_acronym,
            project_description: project.project_description,
            project_information: project.project_information,
            cruise: project.cruise,
            ship: project.ship,
            data_owner_name: project.data_owner_name,
            data_owner_email: project.data_owner_email,
            operator_name: project.operator_name,
            operator_email: project.operator_email,
            chief_scientist_name: project.chief_scientist_name,
            chief_scientist_email: project.chief_scientist_email,
            override_depth_offset: project.override_depth_offset,
            enable_descent_filter: project.enable_descent_filter,
            privacy_duration: project.privacy_duration,
            visible_duration: project.visible_duration,
            public_duration: project.public_duration,
            instrument_model: project.instrument_model,
            serial_number: project.serial_number,
            members: privileges.members,
            managers: privileges.managers,
            contact: privileges.contact,
            project_creation_date: project.project_creation_date
        };

        return publicProject;
    }
    async createProjectRootFolder(root_folder_path: string): Promise<void> {
        try {
            // Check if the folder exists
            await fsPromises.access(root_folder_path);
            // If it exists, remove it recursively
            await fsPromises.rm(root_folder_path, { recursive: true, force: true });
        } catch (error) {
            // Folder does not exist; no need to delete anything
        }
        // Create the root folder
        await fsPromises.mkdir(root_folder_path, { recursive: true });
    }

    async ensureFolderStructureForBackup(root_folder_path: string): Promise<void> {
        // Ensure /raw, /meta, /config EXISTS
        const foldersTocheck = ['raw', 'meta', 'config'];

        for (const folder of foldersTocheck) {
            const folderPath = path.join(this.base_folder, root_folder_path, folder);
            try {
                await fsPromises.access(folderPath);
            } catch (error) {
                throw new Error(`Folder does not exist at path: ${folderPath}`);
            }
        }
    }

    async copyL0bToProjectFolder(source_folder: string, dest_folder: string, skip_already_imported: boolean): Promise<void> {
        // Create destination folder if does not exist
        await fsPromises.mkdir(path.join(this.base_folder, dest_folder), { recursive: true });

        // Copy meta/*, and config/*.
        await this.copy_metadata(this.base_folder, source_folder, dest_folder);

        // Copy L0b files
        if (skip_already_imported === true) {
            await this.copyNewL0bFolders(this.base_folder, source_folder, dest_folder);
        } else {
            await this.copyAllL0bFolders(this.base_folder, source_folder, dest_folder);
        }
    }

    async copy_metadata(base_folder: string, source_folder: string, dest_folder: string): Promise<void> {
        const foldersToCopy = [
            { source: 'meta', dest: 'meta' },
            { source: 'config', dest: 'config' }
        ];

        for (const folder of foldersToCopy) {
            const sourcePath = path.join(base_folder, source_folder, folder.source);
            const destPath = path.join(base_folder, dest_folder, folder.dest);
            const oldDestPath = path.join(base_folder, dest_folder, `old_${folder.dest}`);

            // Ensure the destination folder exists
            await fsPromises.mkdir(destPath, { recursive: true });

            // Rename dest folder to old_{folder.dest}
            await fsPromises.rename(destPath, oldDestPath);
            try {
                // Copy source folder to dest folder using cp
                await fsPromises.cp(sourcePath, destPath, { recursive: true });
            } catch (error) {
                // If an error occurs, restore the old_{folder.dest}
                await fsPromises.rename(oldDestPath, destPath);
                throw error;
            }

            // If everything is ok, remove old_{folder.dest}
            await fsPromises.rm(oldDestPath, { recursive: true, force: true });
        }
    }

    async copyAllL0bFolders(base_folder: string, source_folder: string, dest_folder: string): Promise<void> {
        const sourcePath = path.join(base_folder, source_folder, 'raw');
        const destPath = path.join(base_folder, dest_folder, 'raw');

        // Ensure the destination folder exists
        await fsPromises.mkdir(destPath, { recursive: true });

        // Read all subfolders in the source folder
        const subfolders = await fsPromises.readdir(sourcePath, { withFileTypes: true });

        for (const entry of subfolders) {
            if (entry.isDirectory()) {
                const sourceSubfolder = path.join(sourcePath, entry.name);
                const destZipFile = path.join(destPath, `${entry.name}.zip`);

                // Zip the folder and write to the destination
                await this.zipFolder(sourceSubfolder, destZipFile);
            }
        }
    }

    async zipFolder(sourceFolder: string, destZipFile: string): Promise<void> {
        // Ensure the parent directory of destZipFile exists
        const destDir = path.dirname(destZipFile);
        if (!fs.existsSync(destDir)) {
            throw new Error(`Destination directory does not exist: ${destDir}`);
        }
        // Ensure the destination is not an existing directory
        if (fs.existsSync(destZipFile) && fs.lstatSync(destZipFile).isDirectory()) {
            throw new Error(`Destination path is a directory: ${destZipFile}`);
        }

        // Create a writable stream for the zip file
        const output = fs.createWriteStream(destZipFile);

        // Create a new Archiver instance
        const archive = archiver('zip', { zlib: { level: 9 } });

        // Handle events
        output.on('close', () => {
        });

        archive.on('error', (err) => {
            throw err;
        });

        // Pipe the archive data to the file
        archive.pipe(output);

        // Append the folder to the archive
        archive.directory(sourceFolder, false);

        // Finalize the archive
        await archive.finalize();
    }
    async copyNewL0bFolders(base_folder: string, source_folder: string, dest_folder: string): Promise<void> {
        const sourcePath = path.join(base_folder, source_folder, 'raw');
        const destPath = path.join(base_folder, dest_folder, 'raw');

        // Ensure the destination folder exists
        await fsPromises.mkdir(destPath, { recursive: true });

        // Read all subfolders in the source folder
        const subfolders = await fsPromises.readdir(sourcePath, { withFileTypes: true });

        for (const entry of subfolders) {
            if (entry.isDirectory()) {
                const sourceSubfolder = path.join(sourcePath, entry.name);
                const destSubfolder = path.join(destPath, `${entry.name}.zip`);

                // Check if the subfolder is already copied (check if the zip file exists)
                const zipExists = await this.checkFileExists(destSubfolder);
                if (!zipExists) {
                    // If not, copy and zip the folder
                    // TODO LOG IN TASK LOG FILE `Copying new folder: ${entry.name}`
                    await this.zipFolder(sourceSubfolder, destSubfolder);
                }
                // else {
                //     TODO LOG IN TASK LOG FILE `Skipping already existing folder: ${entry.name}`);
                // }
            }
        }
    }

    async checkFileExists(filePath: string): Promise<boolean> {
        try {
            await fsPromises.access(filePath);
            return true; // File exists
        } catch {
            return false; // File does not exist
        }
    }

    getFormattedDate(date: Date) {
        return date.toISOString()
            .replace('T', '_') // Remplace le 'T' par un underscore
            .replace(/\..+/, '') // Supprime la partie millisecondes et 'Z'
            .replace(/-/g, '_') // Remplace les tirets par des underscores
            .replace(/:/g, '_'); // Remplace les deux-points par des underscores
    }

    async ensureBackupExist(project_id: number): Promise<void> {
        const backuped_project_path = path.join(this.base_folder, this.DATA_STORAGE_FS_STORAGE, project_id.toString(), 'l0b_backup');
        try {
            await fsPromises.access(backuped_project_path);
        } catch (error) {
            throw new Error(`Backup folder does not exist at path: ${backuped_project_path}`);
        }
    }

    async exportBackupedProjectToFtp(project: ProjectResponseModel, task_id: number): Promise<string> {
        // Create the export ftp folder
        const formattedDate = this.getFormattedDate(new Date());

        const exportFolder = path.join(
            this.base_folder,
            this.DATA_STORAGE_EXPORT,
            task_id.toString()
        );

        // Create the export zip file path
        await fsPromises.mkdir(exportFolder, { recursive: true });
        const exportZip = path.join(
            exportFolder,
            `ecopart_export_backup_${project.project_id.toString()}_${formattedDate}.zip`
        );
        await this.copyZippedL0bFoldersToExportFolder(project, exportZip);
        return exportZip;
    }

    async exportBackupedProjectToFs(project: ProjectResponseModel, task_id: number): Promise<string> {
        // Create the export fs folder 
        const formattedDate = this.getFormattedDate(new Date());
        const exportFolder = path.join(
            this.base_folder,
            this.DATA_STORAGE_FOLDER,
            'tasks',
            task_id.toString(),
        );
        await fsPromises.mkdir(exportFolder, { recursive: true });

        // Create the export zip file path
        const exportZip = path.join(
            exportFolder,
            `ecopart_export_backup_${project.project_id.toString()}_${formattedDate}.zip`
        );
        await this.copyZippedL0bFoldersToExportFolder(project, exportZip);

        return exportZip;
    }

    async copyZippedL0bFoldersToExportFolder(project: ProjectResponseModel, exportFolder: string): Promise<void> {
        //  with date
        const backupedProjectPath = path.join(this.base_folder, this.DATA_STORAGE_FS_STORAGE, project.project_id.toString(), 'l0b_backup');
        // zip and copy backupedProjectPath to exportFolder
        await this.zipFolder(backupedProjectPath, exportFolder);
    }

}