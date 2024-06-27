import { PublicPrivilege } from "../../src/domain/entities/privilege";
import { PrivilegeRepository } from "../../src/domain/interfaces/repositories/privilege-repository";

export class MockPrivilegeRepository implements PrivilegeRepository {
    isManager(): unknown {
        throw new Error("Method not implemented.");
    }
    ensurePrivilegeCoherence(): void {
        throw new Error("Method not implemented.");
    }
    getProjectsByMembers(): Promise<number[]> {
        throw new Error("Method not implemented.");
    }
    getProjectsByManagers(): Promise<number[]> {
        throw new Error("Method not implemented.");
    }
    getProjectsByContacts(): Promise<number[]> {
        throw new Error("Method not implemented.");
    }
    getProjectsByUsers(): Promise<number[]> {
        throw new Error("Method not implemented.");
    }
    getProjectsByUser(): Promise<number[]> {
        throw new Error("Method not implemented.");
    }
    isGranted(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    createPrivileges(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    getPublicPrivileges(): Promise<PublicPrivilege> {
        throw new Error("Method not implemented.");
    }
    deletePrivileges(): Promise<number> {
        throw new Error("Method not implemented.");
    }

}