import fs from 'node:fs/promises';
import path from 'path';
import { ListImportFoldersUseCase } from '../../interfaces/use-cases/file_system/list-import-folders';

export class ListImportFolders implements ListImportFoldersUseCase {
    importFolderPath: string

    constructor(importFolderPath: string) {
        this.importFolderPath = importFolderPath
    }

    async execute(): Promise<string[]> {
        const folders: string[] = [];
        await this.listFoldersRecursive(this.importFolderPath, folders);
        return folders.sort((a, b) => a.localeCompare(b));
    }

    private async listFoldersRecursive(dirPath: string, result: string[]): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const fullPath = path.join(dirPath, entry.name);
                result.push(fullPath);
                await this.listFoldersRecursive(fullPath, result);
            }
        }
    }
}
