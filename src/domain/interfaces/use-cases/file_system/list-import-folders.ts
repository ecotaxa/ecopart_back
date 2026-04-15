export interface ListImportFoldersUseCase {
    execute(folder_path: string): Promise<string[]>;
}
