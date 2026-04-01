export interface ListImportFoldersUseCase {
    execute(): Promise<string[]>;
}
