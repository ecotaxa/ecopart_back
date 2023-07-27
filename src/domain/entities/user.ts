
// // full user object
// export interface User {
//     id?: string;
//     password: string;
//     firstName: string;
//     lastName: string;
//     email: string;
//     status: "pending" | "active" | "suspended";
// }

// the user request model 
export interface UserRequestModel {
    password: string;
    firstName: string;
    lastName: string;
    email: string;
}

// the user response model
export interface UserResponseModel {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    status: string//"pending" | "active" | "suspended";
}