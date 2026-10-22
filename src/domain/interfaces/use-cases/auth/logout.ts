export interface LogoutUserUseCase {
    execute(refresh_token: string | undefined): Promise<void>;
}
