import fs from 'node:fs/promises';
import path from 'path';
import { ListImportFoldersUseCase } from '../../interfaces/use-cases/file_system/list-import-folders';

export class ListImportFolders implements ListImportFoldersUseCase {
    importFolderPath: string

    constructor(importFolderPath: string) {
        this.importFolderPath = importFolderPath
    }

    async execute(folder_path: string): Promise<string[]> {
        const targetPath = path.join(this.importFolderPath, folder_path);
        const resolvedPath = path.resolve(targetPath);
        const resolvedRoot = path.resolve(this.importFolderPath);

        // Prevent directory traversal outside the import root
        if (!resolvedPath.startsWith(resolvedRoot)) {
            throw new Error("Invalid folder path");
        }

        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const folders: string[] = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                folders.push(path.join(folder_path, entry.name));
            }
        }
        return folders.sort((a, b) => a.localeCompare(b));
    }
}
