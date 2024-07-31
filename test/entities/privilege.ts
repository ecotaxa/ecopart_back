
// define an example of project entities to use in the tests

import { PrivilegeRequestCreationModel, PrivilegeResponseModel, PublicPrivilege } from "../../src/domain/entities/privilege"
import { MinimalUserModel } from "../../src/domain/entities/user"

export const publicPrivileges: PublicPrivilege = {
    project_id: 1,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [],
    contact: { user_id: 1 } as MinimalUserModel
}
export const publicPrivileges_WithMemberAndManager: PublicPrivilege = {
    project_id: 1,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
    contact: { user_id: 1 } as MinimalUserModel
}
export const publicPrivilegesResponse_WithMemberAndManager: PublicPrivilege = {
    project_id: 1,
    managers: [{
        user_id: 1,
        user_name: "user1",
        email: "test",
    }],
    members: [{
        user_id: 2,
        user_name: "user2",
        email: "test",
    }],
    contact: {
        user_id: 1,
        user_name: "user1",
        email: "test",
    }
}

export const privilegesResponse_WithMemberAndManager: PrivilegeResponseModel[] = [
    {
        privilege_id: 1,
        user_id: 1,
        project_id: 1,
        privilege_name: "manager",
        contact: true,
        user_name: "user1",
        email: "test",
        privilege_creation_date: "2021-01-01"
    },
    {
        privilege_id: 2,
        user_id: 2,
        project_id: 1,
        privilege_name: "member",
        contact: false,
        user_name: "user2",
        email: "test",
        privilege_creation_date: "2021-01-01"
    }]
export const privilegesRequestCreation_WithMemberAndManager: PrivilegeRequestCreationModel[] = [
    {
        user_id: 1,
        project_id: 1,
        privilege_name: "manager",
        contact: true
    },
    {
        user_id: 2,
        project_id: 1,
        privilege_name: "member",
        contact: false
    }]

export const privileges_WithOneUserMemberAndManager: PublicPrivilege =
{
    project_id: 1,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 1 } as MinimalUserModel],
    contact: { user_id: 1 } as MinimalUserModel
}

export const privileges_WithContactNetherManagerNorMember: PublicPrivilege =
{
    project_id: 1,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
    contact: { user_id: 3 } as MinimalUserModel
}


export const privileges_WithNoManager: PublicPrivilege =
{
    project_id: 1,
    managers: [],
    members: [{ user_id: 1 } as MinimalUserModel],
    contact: { user_id: 1 } as MinimalUserModel
}

export const coherentPrivileges: PublicPrivilege = {
    project_id: 1,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
    contact: { user_id: 1 } as MinimalUserModel
}