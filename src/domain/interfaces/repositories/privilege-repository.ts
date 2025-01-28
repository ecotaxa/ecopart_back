// import { ProjectRequestCreationModel, ProjectRequestModel, ProjectUpdateModel, PublicProjectResponseModel } from "../../entities/project";
// import { PreparedSearchOptions, SearchResult } from "../../entities/search";

import { PrivilegeRequestModel, PrivilegeResponseModel, PublicPrivilege } from "../../entities/privilege";
import { ProjectRequestModel } from "../../entities/project";

export interface PrivilegeRepository {
    isManager(is_granted_params: PrivilegeRequestModel): unknown;
    ensurePrivilegeCoherence(publicPrivilege: PublicPrivilege): void;
    getProjectsByMembers(user_ids: number[]): Promise<number[]>;
    getProjectsByManagers(user_ids: number[]): Promise<number[]>;
    getProjectsByContacts(user_ids: number[]): Promise<number[]>;
    getProjectsByUsers(user_ids: number[]): Promise<number[]>;
    getProjectsByUser(privilege: PrivilegeRequestModel): Promise<number[]>;
    isGranted(privilege: PrivilegeRequestModel): Promise<boolean>;
    getContact(project: ProjectRequestModel): Promise<PrivilegeResponseModel>;
    createPrivileges(publicPrivilege: PublicPrivilege): Promise<number>;
    getPublicPrivileges(project: ProjectRequestModel): Promise<PublicPrivilege | null>;
    deletePrivileges(privilege: PrivilegeRequestModel): Promise<number>
}
