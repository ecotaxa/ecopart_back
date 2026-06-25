import { UserUpdateModel, UserMigrationRequestModel, MigrateUsersResponseModel } from "../../../entities/user";
export interface MigrateUsersUseCase {
    execute(current_user: UserUpdateModel, users: UserMigrationRequestModel[], dry_run: boolean): Promise<MigrateUsersResponseModel>;
}
