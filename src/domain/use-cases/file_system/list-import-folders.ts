import fs from 'node:fs/promises';
import path from 'path';
import { ListImportFoldersUseCase } from '../../interfaces/use-cases/file_system/list-import-folders';
import { UserRepository } from '../../interfaces/repositories/user-repository';
import { UserUpdateModel } from '../../entities/user';
import { resolveInsideImportFolder } from './import-folder-path';

export class ListImportFolders implements ListImportFoldersUseCase {
    importFolderPath: string
    userRepository: UserRepository

    constructor(importFolderPath: string, userRepository: UserRepository) {
        this.importFolderPath = importFolderPath
        this.userRepository = userRepository
    }

    // Any user may browse the import folders to create a project on one of them (data producer role).
    async execute(current_user: UserUpdateModel, folder_path: string): Promise<string[]> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        const resolvedPath = resolveInsideImportFolder(this.importFolderPath, folder_path);

        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const folders: string[] = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                folders.push(path.join(folder_path, entry.name));
            } else if (entry.isSymbolicLink()) {
                // readdir does not follow symlinks: stat the target to keep links pointing to directories
                try {
                    const stats = await fs.stat(path.join(resolvedPath, entry.name));
                    if (stats.isDirectory()) {
                        folders.push(path.join(folder_path, entry.name));
                    }
                } catch {
                    // broken or unreadable symlink: skip it
                }
            }
        }
        return folders.sort((a, b) => a.localeCompare(b));
    }
}
