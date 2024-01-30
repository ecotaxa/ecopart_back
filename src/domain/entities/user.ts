export enum UserStatus {
    Pending = "PENDING",
    Active = "ACTIVE",
    Anonym = "ANONYM"
}

export interface UserRequesCreationtModel {
    password: string;
    first_name: string;
    last_name: string;
    email: string;
    confirmation_code?: string | null;
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
    user_creation_date?: string;
    deleted?: string;
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
    user_creation_date?: string;
    deleted?: string;
}

export interface UserResponseModel extends PublicUserModel {
    deleted?: string;
    confirmation_code?: string | null;
    reset_password_code?: string | null;
}
export interface PublicUserModel {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    valid_email: boolean;
    is_admin: boolean;
    organisation: string;
    country: string;
    user_planned_usage: string;
    user_creation_date: string;
}
export interface PrivateUserModel extends PublicUserModel, UserResponseModel {
    password_hash?: string;
}