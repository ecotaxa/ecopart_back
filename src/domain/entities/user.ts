
// // full user object
// export interface User {
//     id?: string;
//     password: string;
//     firstName: string;
//     lastName: string;
//     email: string;
//     status: "Pending" | "active" | "suspended";
// }

// the user request model 
export interface UserRequesCreationtModel {
    password: string;
    firstName: string;
    lastName: string;
    email: string;
    organisation: string;
    country: string;
    user_planned_usage: string;
}
export interface UserRequestModel {
    id?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
    status?: string//"Pending" | "active" | "suspended";
    organisation?: string;
    country?: string;
    user_planned_usage?: string;
    user_creation_date?: string;
}

// the user response model
export interface UserResponseModel {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    status: string//"Pending" | "active" | "suspended";
    organisation: string;
    country: string;
    user_planned_usage: string;
    user_creation_date: string; //YYYY-MM-DD HH:MM:SS TimeStamp
}
