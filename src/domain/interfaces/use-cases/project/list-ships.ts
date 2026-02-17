export interface ListShipsUseCase {
    execute(): Promise<string[]>;
}
