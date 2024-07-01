import { PublicPrivilege } from "../../src/domain/entities/privilege";
import { PrivilegeRepository } from "../../src/domain/interfaces/repositories/privilege-repository";

export class MockPrivilegeRepository implements PrivilegeRepository {
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