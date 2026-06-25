import { UserUpdateModel, MigrateUsersResponseModel } from "../../../entities/user";
export interface ResendMigrationEmailsUseCase {
    execute(current_user: UserUpdateModel, dry_run: boolean): Promise<MigrateUsersResponseModel>;
}
