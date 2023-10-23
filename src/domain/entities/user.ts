
// // full user object
// export interface User {
//     id?: string;
//     password: string;
//     first_name: string;
//     last_name: string;
//     email: string;
//     status: "Pending" | "active" | "suspended";
// }

// the user request model 
export interface UserRequesCreationtModel {
    password: string;
    first_name: string;
    last_name: string;
    email: string;
    organisation: string;
    country: string;
    user_planned_usage: string;
}
export interface UserRequestModel {
    id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    status?: string//"Pending" | "active" | "suspended";
    is_admin?: boolean;
    organisation?: string;
    country?: string;
    user_planned_usage?: string;
    user_creation_date?: string;
}
export interface UserUpdateModel {
    [key: string]: any;
    id: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    status?: string//"Pending" | "active" | "suspended";
    is_admin?: boolean;
    organisation?: string;
    country?: string;
    user_planned_usage?: string;
    user_creation_date?: string;
}

// the user response model
export interface UserResponseModel {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    status: string//"Pending" | "active" | "suspended";
    is_admin: boolean;
    organisation: string;
    country: string;
    user_planned_usage: string;
    user_creation_date: string; //YYYY-MM-DD HH:MM:SS TimeStamp
}
