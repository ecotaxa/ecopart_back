import { MinimalUserModel } from "./user";

export interface PrivilegeRequestCreationModel {
    user_id: number;
    project_id: number;
    privilege_name: string;
    contact: boolean;
}
export interface PrivilegeRequestModel {
    privilege_id?: number;
    user_id?: number;
    project_id?: number;
    privilege_name?: string;
    contact?: boolean;
}
export interface PrivilegeResponseModel extends PrivilegeRequestCreationModel {
    privilege_id: number;
    user_name: string;
    email: string;
    privilege_creation_date: string;
}

export interface PublicPrivilege {
    project_id: number;
    members: MinimalUserModel[];
    managers: MinimalUserModel[];
    contact: MinimalUserModel;
}