
export interface ValidUserUseCase {
    //execute(confirmation_code: string): Promise<void>;
    execute(user_id: number, confirmation_code: string): Promise<void>;
}