export enum UserStatus {
    Pending = "PENDING",
    Active = "ACTIVE",
    Anonym = "ANONYM"
}

// the user request model 
export interface UserRequesCreationtModel {
    password: string;
    first_name: string;
    last_name: string;
    email: string;
    confirmation_code?: string;
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
    confirmation_code?: string;
    is_admin?: boolean;
    organisation?: string;
    country?: string;
    user_planned_usage?: string;
    user_creation_date?: string;
}
export interface UserUpdateModel {
    [key: string]: any;
    user_id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    valid_email?: boolean;
    confirmation_code?: string;
    password_hash?: string;
    is_admin?: boolean;
    organisation?: string;
    country?: string;
    user_planned_usage?: string;
    user_creation_date?: string;
}

// the user response model
export interface UserResponseModel {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    valid_email: boolean;
    confirmation_code?: string;
    is_admin: boolean;
    organisation: string;
    country: string;
    user_planned_usage: string;
    user_creation_date: string; //YYYY-MM-DD HH:MM:SS TimeStamp
}
