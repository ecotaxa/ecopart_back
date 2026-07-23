export enum UserStatus {
    Pending = "PENDING",
    Active = "ACTIVE",
    Anonym = "ANONYM"
}

export interface UserRequestCreationModel {
    password: string;
    first_name: string;
    last_name: string;
    email: string;
    confirmation_code?: string | null;
    organisation: string;
    country: string;
    user_planned_usage: string;
}
export interface UserSeedModel {
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    organisation: string;
    country: string;
    user_planned_usage: string;
}
export interface UserMigrationRequestModel {
    legacy_ecopart_user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    organisation: string;
    country: string;
    user_planned_usage: string;
}
export interface UserRequestModel {
    user_id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    valid_email?: boolean;
    confirmation_code?: string | null;
    reset_password_code?: string | null;
    is_admin?: boolean;
    organisation?: string;
    country?: string;
    user_planned_usage?: string;
    user_creation_utc_date_time?: string;
    deleted?: string;
    legacy_ecopart_user_id?: number | null;
    legacy_password_set?: boolean | null;
}
export interface UserUpdateModel {
    [key: string]: any;
    user_id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    valid_email?: boolean;
    confirmation_code?: string | null;
    reset_password_code?: string | null;
    password_hash?: string;
    is_admin?: boolean;
    organisation?: string;
    country?: string;
    user_planned_usage?: string;
    user_creation_utc_date_time?: string;
    deleted?: string;
    legacy_ecopart_user_id?: number | null;
    legacy_password_set?: boolean | null;
}

export interface UserResponseModel extends PublicUserModel {
    valid_email?: boolean;
    deleted?: string;
    confirmation_code?: string | null;
    reset_password_code?: string | null;
    legacy_ecopart_user_id?: number | null;
    legacy_password_set?: boolean | null;
    // Project memberships, only populated for admin searches
    managing_projects?: number[];
    member_projects?: number[];
}
export interface PublicUserModel {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    // valid_email: boolean;
    is_admin: boolean;
    organisation: string;
    country: string;
    user_planned_usage: string;
    user_creation_utc_date_time: string;
}
export interface PrivateUserModel extends PublicUserModel, UserResponseModel {
    password_hash?: string;
}

export interface MinimalUserModel {
    user_id: number;
    user_name: string;
    email: string;
}

export type UserMigrationStatus =
    | "created"
    | "email_resent"
    | "linked_existing_user"
    | "skipped_already_migrated"
    | "would_create"
    | "would_resend"
    | "would_link"
    | "error";

export interface UserMigrationResultModel {
    email: string;
    legacy_ecopart_user_id: number;
    status: UserMigrationStatus;
    message?: string;
}

export interface MigrateUsersResponseModel {
    dry_run: boolean;
    summary: { [status in UserMigrationStatus]?: number } & { total: number };
    results: UserMigrationResultModel[];
}
