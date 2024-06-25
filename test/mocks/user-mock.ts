import { DecodedToken } from "../../src/domain/entities/auth";
import { SearchResult } from "../../src/domain/entities/search";
import { UserResponseModel } from "../../src/domain/entities/user";
import { UserRepository } from "../../src/domain/interfaces/repositories/user-repository";

export class MockUserRepository implements UserRepository {
    isValidated(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    canUserBeUse(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    ensureUserCanBeUsed(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    ensureTypedUserCanBeUsed(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    adminGetUsers(): Promise<SearchResult<UserResponseModel>> {
        throw new Error("Method not implemented : adminGetUsers");
    }
    standardGetUsers(): Promise<SearchResult<UserResponseModel>> {
        throw new Error("Method not implemented : standardGetUsers");
    }
    deleteUser(): Promise<number> {
        throw new Error("Method not implemented : deleteUser");
    }
    isDeleted(): Promise<boolean> {
        throw new Error("Method not implemented : isDeleted");
    }
    generateResetPasswordToken(): string {
        throw new Error("Method not implemented : generateResetPasswordToken");
    }
    verifyResetPasswordToken(): DecodedToken | null {
        throw new Error("Method not implemented : verifyResetPasswordToken");
    }
    setResetPasswordCode(): Promise<number> {
        throw new Error("Method not implemented : setResetPasswordCode");
    }
    toPublicUser(): UserResponseModel {
        throw new Error("Method not implemented : toPublicUser");
    }
    changePassword(): Promise<number> {
        throw new Error("Method not implemented : changePassword");
    }
    adminUpdateUser(): Promise<number> {
        throw new Error("Method not implemented : adminUpdateUser");
    }
    standardUpdateUser(): Promise<number> {
        throw new Error("Method not implemented : standardUpdateUser");
    }
    isAdmin(): Promise<boolean> {
        throw new Error("Method not implemented : isAdmin");
    }
    createUser(): Promise<number> {
        throw new Error("Method not implemented : createUser");
    }
    getUsers(): Promise<UserResponseModel[]> {
        throw new Error("Method not implemented : getUsers");
    }
    getUser(): Promise<UserResponseModel | null> {
        throw new Error("Method not implemented : getUser");
    }
    verifyUserLogin(): Promise<boolean> {
        throw new Error("Method not implemented : verifyUserLogin");
    }
    validUser(): Promise<number> {
        throw new Error("Method not implemented : validUser");
    }
    generateValidationToken(): string {
        throw new Error("Method not implemented : generateValidationToken");
    }
    verifyValidationToken(): DecodedToken | null {
        throw new Error("Method not implemented : verifyValidationToken");
    }
}