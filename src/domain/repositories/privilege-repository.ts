
import { PrivilegeDataSource } from "../../data/interfaces/data-sources/privilege-data-source";
import { PrivilegeRequestCreationModel, PrivilegeRequestModel, PrivilegeResponseModel, PublicPrivilege } from "../entities/privilege";
import { ProjectRequestModel } from "../entities/project";
import { FilterSearchOptions, PreparedSearchOptions, SearchResult } from "../entities/search";
import { PrivilegeRepository } from "../interfaces/repositories/privilege-repository";

export class PrivilegeRepositoryImpl implements PrivilegeRepository {
    privilegeDataSource: PrivilegeDataSource

    constructor(privilegeDataSource: PrivilegeDataSource) {
        this.privilegeDataSource = privilegeDataSource
    }

    async createPrivileges(publicPrivilege: PublicPrivilege): Promise<number> {
        const privileges = await this.publicToPrivate(publicPrivilege)
        let result = 0;
        for (const privilege of privileges) {
            try {
                await this.privilegeDataSource.create(privilege)
                result += 1
            } catch (error) {
                console.error(error)
            }
        }
        return result;
    }

    async publicToPrivate(publicPrivilege: PublicPrivilege): Promise<PrivilegeRequestCreationModel[]> {
        const privileges: PrivilegeRequestCreationModel[] = publicPrivilege.managers.map(manager => {
            return {
                project_id: publicPrivilege.project_id,
                user_id: manager.user_id,
                privilege_name: "manager",
                contact: publicPrivilege.contact.user_id === manager.user_id
            }
        }).concat(publicPrivilege.members.map(member => {
            return {
                project_id: publicPrivilege.project_id,
                user_id: member.user_id,
                privilege_name: "member",
                contact: publicPrivilege.contact.user_id === member.user_id
            }
        }))
        return privileges
    }

    async getPrivileges(project: ProjectRequestModel): Promise<PrivilegeResponseModel[]> {
        const filter = [{
            field: "project_id",
            operator: "=",
            value: project.project_id
        }];
        const privileges = await this.getPrivilegesByFilter(filter)
        return privileges.items
    }

    async getPublicPrivileges(project: ProjectRequestModel): Promise<PublicPrivilege | null> {

        const privileges: PrivilegeResponseModel[] = await this.getPrivileges(project)
        if (privileges.length === 0) {
            return null;
        }
        const publicPrivilege: PublicPrivilege = {
            project_id: project.project_id,
            members: privileges.filter(
                privilege => privilege.privilege_name === "member"
            ).map(privilege => ({
                user_id: privilege.user_id,
                user_name: privilege.user_name,
                email: privilege.email
            })),
            managers: privileges.filter(
                privilege => privilege.privilege_name === "manager"
            ).map(privilege => ({
                user_id: privilege.user_id,
                user_name: privilege.user_name,
                email: privilege.email
            })),
            contact: privileges.filter(
                privilege => privilege.contact
            ).map(privilege => ({
                user_id: privilege.user_id,
                user_name: privilege.user_name,
                email: privilege.email
            }))[0]
        }
        return publicPrivilege;
    }
    // Get projects by filter
    async getPrivilegesByFilter(filters: FilterSearchOptions[]): Promise<SearchResult<PrivilegeResponseModel>> {
        const prepare_options: PreparedSearchOptions = {
            filter: filters,
            sort_by: [{ sort_by: "privilege_creation_date", order_by: "desc" }],
            limit: 1000,
            page: 1
        };
        const privileges = await this.privilegeDataSource.getAll(prepare_options);
        return privileges
    }

    // Get all projects where one has at least one privilege
    async getProjectsByUser(privilege: PrivilegeRequestModel): Promise<number[]> {
        const filter = [{
            field: "user_id",
            operator: "=",
            value: privilege.user_id
        }];
        const privileges = await this.getPrivilegesByFilter(filter)
        return privileges.items.map(privilege => privilege.project_id);
        // [ ...new Set(privileges.items.map(privilege => privilege.project_id);)]  
    }

    // Get all projects where a list of user ids have at least one privilege
    async getProjectsByUsers(user_ids: number[]): Promise<number[]> {
        const filter = [{
            field: "user_id",
            operator: "IN",
            value: user_ids
        }];
        const privileges = await this.getPrivilegesByFilter(filter)
        return [...new Set(privileges.items.map(privilege => privilege.project_id))]
    }

    // Get all projects where a list of user ids are contact
    async getProjectsByContacts(user_ids: number[]): Promise<number[]> {
        const filter = [{
            field: "user_id",
            operator: "IN",
            value: user_ids
        },
        {
            field: "contact",
            operator: "=",
            value: true
        }];
        const privileges = await this.getPrivilegesByFilter(filter)
        return [...new Set(privileges.items.map(privilege => privilege.project_id))]
    }

    // Get all projects where a list of user ids are managers
    async getProjectsByManagers(user_ids: number[]): Promise<number[]> {
        const filter = [{
            field: "user_id",
            operator: "IN",
            value: user_ids
        },
        {
            field: "privilege_name",
            operator: "=",
            value: "manager"
        }];
        const privileges = await this.getPrivilegesByFilter(filter)
        return [...new Set(privileges.items.map(privilege => privilege.project_id))]
    }

    // Get all projects where a list of user ids are members
    async getProjectsByMembers(user_ids: number[]): Promise<number[]> {
        const filter = [{
            field: "user_id",
            operator: "IN",
            value: user_ids
        },
        {
            field: "privilege_name",
            operator: "=",
            value: "member"
        }];
        const privileges = await this.getPrivilegesByFilter(filter)
        return [...new Set(privileges.items.map(privilege => privilege.project_id))]
    }

    async isGranted(privilege: PrivilegeRequestModel): Promise<boolean> {
        if (!privilege.user_id || !privilege.project_id) {
            throw new Error("Please provide a valid user_id and project_id to check if a privilege is granted for a project and a user")
        }
        const prepare_options: PreparedSearchOptions = {
            filter: [
                {
                    field: "user_id",
                    operator: "=",
                    value: privilege.user_id
                },
                {
                    field: "project_id",
                    operator: "=",
                    value: privilege.project_id
                }
            ],
            sort_by: [{ sort_by: "privilege_creation_date", order_by: "desc" }],
            limit: 1,
            page: 1

        }
        const privileges = await this.privilegeDataSource.getAll(prepare_options)
        return privileges.items.length > 0;
    }
    async isManager(is_granted_params: PrivilegeRequestModel): Promise<boolean> {
        if (!is_granted_params.user_id || !is_granted_params.project_id) {
            throw new Error("Please provide a valid user_id and project_id to check if a user is a manager for a project")
        }
        const filter = [
            {
                field: "user_id",
                operator: "=",
                value: is_granted_params.user_id
            },
            {
                field: "project_id",
                operator: "=",
                value: is_granted_params.project_id
            },
            {
                field: "privilege_name",
                operator: "=",
                value: "manager"
            }
        ]

        const privileges = await this.getPrivilegesByFilter(filter)
        return privileges.items.length > 0;
    }

    async getContact(project: ProjectRequestModel): Promise<PrivilegeResponseModel> {
        const prepare_options: PreparedSearchOptions = {
            filter: [
                {
                    field: "project_id",
                    operator: "=",
                    value: project.project_id
                },
                {
                    field: "contact",
                    operator: "=",
                    value: true
                }
            ],
            sort_by: [{ sort_by: "privilege_creation_date", order_by: "desc" }],
            limit: 1,
            page: 1

        }
        const privileges = await this.privilegeDataSource.getAll(prepare_options)
        if (privileges.items.length === 0) {
            throw new Error("No contact found for this project")
        }
        return privileges.items[0];
    }

    async deletePrivileges(privilege: PrivilegeRequestModel): Promise<number> {
        // Keep only user_id, project_id and privilege_id keys
        const filtered_privilege: Partial<PrivilegeRequestModel> = {};
        Object.keys(privilege).forEach(key => {
            if (key === 'user_id' || key === 'project_id' || key === 'privilege_id') {
                filtered_privilege[key] = privilege[key];
            }
        });
        // If empty object, throw an error
        if (Object.keys(filtered_privilege).length === 0) {
            throw new Error('Please provide at least one valid parameter to delete privilege');
        }
        const result = await this.privilegeDataSource.deleteAll(filtered_privilege)
        return result;
    }

    ensurePrivilegeCoherence(publicPrivilege: PublicPrivilege): void {
        this.ensureContactInMembersOrManagers(publicPrivilege);
        this.ensureAtLeastOneManager(publicPrivilege);
        this.ensureNoUserInBothRoles(publicPrivilege);
    }

    // Ensure the contact is in either members or managers
    private ensureContactInMembersOrManagers(publicProject: PublicPrivilege): void {
        const isContactInMembers = publicProject.members.some(member => member.user_id === publicProject.contact.user_id);
        const isContactInManagers = publicProject.managers.some(manager => manager.user_id === publicProject.contact.user_id);

        if (!isContactInMembers && !isContactInManagers) {
            throw new Error("Contact user must be either in members or managers");
        }
    }

    // Ensure at least one user is a manager
    private ensureAtLeastOneManager(publicProject: PublicPrivilege): void {
        if (publicProject.managers.length <= 0) {
            throw new Error("At least one user must be a manager");
        }
    }

    // Ensure no user is both a member and a manager
    private ensureNoUserInBothRoles(publicProject: PublicPrivilege): void {
        const memberIds = new Set(publicProject.members.map(member => member.user_id));
        for (const manager of publicProject.managers) {
            if (memberIds.has(manager.user_id)) {
                throw new Error("A user cannot be both a member and a manager");
            }
        }
    }
}      
