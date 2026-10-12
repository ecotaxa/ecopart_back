export interface RecoverInterruptedTasksUseCase {
    execute(): Promise<number>;
}
