import fs from 'node:fs/promises';
import path from 'path';
import { ListImportFoldersUseCase } from '../../interfaces/use-cases/file_system/list-import-folders';

export class ListImportFolders implements ListImportFoldersUseCase {
    importFolderPath: string

    constructor(importFolderPath: string) {
        this.importFolderPath = importFolderPath
    }

    async execute(): Promise<string[]> {
        const entries = await fs.readdir(this.importFolderPath, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory())
            .map(entry => path.join(this.importFolderPath, entry.name))
            .sort((a, b) => a.localeCompare(b));
    }
}
