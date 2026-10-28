// import { ProjectRequestCreationModel, ProjectRequestModel, ProjectUpdateModel, PublicProjectResponseModel } from "../../entities/project";
// import { PreparedSearchOptions, SearchResult } from "../../entities/search";

import { PrivilegeRequestCreationModel, PrivilegeRequestModel, PrivilegeResponseModel, PublicPrivilege } from "../../entities/privilege";
import { ProjectRequestModel } from "../../entities/project";

export interface PrivilegeRepository {
    isManager(is_granted_params: PrivilegeRequestModel): Promise<boolean>;
    ensurePrivilegeCoherence(publicPrivilege: PublicPrivilege): void;
    getProjectsByMembers(user_ids: number[]): Promise<number[]>;
    getProjectsByManagers(user_ids: number[]): Promise<number[]>;
    getProjectsByContacts(user_ids: number[]): Promise<number[]>;
    getProjectsByUsers(user_ids: number[]): Promise<number[]>;
    getProjectsByUser(privilege: PrivilegeRequestModel): Promise<number[]>;
    isGranted(privilege: PrivilegeRequestModel): Promise<boolean>;
    getContact(project: ProjectRequestModel): Promise<PrivilegeResponseModel>;
    createPrivileges(publicPrivilege: PublicPrivilege): Promise<number>;
    addPrivilege(privilege: PrivilegeRequestCreationModel): Promise<number>;
    getPublicPrivileges(project: ProjectRequestModel): Promise<PublicPrivilege | null>;
    // The same for many projects in one query; projects without privileges are absent from the map.
    getPublicPrivilegesOfProjects(project_ids: number[]): Promise<Map<number, PublicPrivilege>>;
    deletePrivileges(privilege: PrivilegeRequestModel): Promise<number>
}
