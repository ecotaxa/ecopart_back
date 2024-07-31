import { PrivilegeResponseModel, PublicPrivilege } from "../../src/domain/entities/privilege";
import { SearchResult } from "../../src/domain/entities/search";
import { PrivilegeRepository } from "../../src/domain/interfaces/repositories/privilege-repository";
import { PrivilegeDataSource } from "../../src/data/interfaces/data-sources/privilege-data-source";

export class MockPrivilegeRepository implements PrivilegeRepository {
    getContact(): Promise<PrivilegeResponseModel> {
        throw new Error("Method not implemented for privilege mock getContact");
    }
    isManager(): unknown {
        throw new Error("Method not implemented for privilege mock isManager");
    }
    ensurePrivilegeCoherence(): void {
        throw new Error("Method not implemented for privilege mock ensurePrivilegeCoherence");
    }
    getProjectsByMembers(): Promise<number[]> {
        throw new Error("Method not implemented for privilege mock getProjectsByMembers");
    }
    getProjectsByManagers(): Promise<number[]> {
        throw new Error("Method not implemented for privilege mock getProjectsByManagers");
    }
    getProjectsByContacts(): Promise<number[]> {
        throw new Error("Method not implemented for privilege mock getProjectsByContacts");
    }
    getProjectsByUsers(): Promise<number[]> {
        throw new Error("Method not implemented for privilege mock getProjectsByUsers");
    }
    getProjectsByUser(): Promise<number[]> {
        throw new Error("Method not implemented for privilege mock getProjectsByUser");
    }
    isGranted(): Promise<boolean> {
        throw new Error("Method not implemented for privilege mock isGranted");
    }
    createPrivileges(): Promise<number> {
        throw new Error("Method not implemented for privilege mock createPrivileges");
    }
    getPublicPrivileges(): Promise<PublicPrivilege> {
        throw new Error("Method not implemented for privilege mock getPublicPrivileges");
    }
    deletePrivileges(): Promise<number> {
        throw new Error("Method not implemented for privilege mock deletePrivileges");
    }

}
export class MockPrivilegeDataSource implements PrivilegeDataSource {
    deleteAll(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    create(): Promise<number> {
        throw new Error("Method not implemented : create");
    }
    getAll(): Promise<SearchResult<PrivilegeResponseModel>> {
        throw new Error("Method not implemented : getAll");
    }
    updateOne(): Promise<number> {
        throw new Error("Method not implemented : updateOne");
    }
    getOne(): Promise<PrivilegeResponseModel | null> {
        throw new Error("Method not implemented : getOne");
    }
    deleteOne(): Promise<number> {
        throw new Error("Method not implemented : deleteOne");
    }
}