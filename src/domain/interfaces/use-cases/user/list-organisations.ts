export interface ListOrganisationsUseCase {
    execute(): Promise<string[]>;
}
