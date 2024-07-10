import { DecodedToken } from "../../src/domain/entities/auth";
import { SearchResult } from "../../src/domain/entities/search";
import { UserResponseModel } from "../../src/domain/entities/user";
import { UserRepository } from "../../src/domain/interfaces/repositories/user-repository";
import { CreateUserUseCase } from "../../src/domain/interfaces/use-cases/user/create-user";
import { UpdateUserUseCase } from "../../src/domain/interfaces/use-cases/user/update-user";
import { ValidUserUseCase } from "../../src/domain/interfaces/use-cases/user/valid-user";
import { MiddlewareAuth } from "../../src/presentation/interfaces/middleware/auth";
import { DeleteUserUseCase } from "../../src/domain/interfaces/use-cases/user/delete-user";
import { SearchUsersUseCase } from "../../src/domain/interfaces/use-cases/user/search-user";

import { Request, Response, NextFunction } from "express";

export class MockUserRepository implements UserRepository {
    isValidated(): Promise<boolean> {
        throw new Error("Method not implemented for isValidated");
    }
    canUserBeUse(): Promise<boolean> {
        throw new Error("Method not implemented for canUserBeUse");
    }
    ensureUserCanBeUsed(): Promise<void> {
        throw new Error("Method not implemented for ensureUserCanBeUsed");
    }
    ensureTypedUserCanBeUsed(): Promise<void> {
        throw new Error("Method not implemented for ensureTypedUserCanBeUsed");
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


export class MockCreateUserUseCase implements CreateUserUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for CreateUserUseCase");
    }
}
export class MockUpdateUserUseCase implements UpdateUserUseCase {
    execute(): Promise<UserResponseModel> {
        throw new Error("Method not implemented for UpdateUserUseCase");
    }
}

export class MockValidUserUseCase implements ValidUserUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for ValidUserUseCase");
    }
}

export class MockMiddlewareAuth implements MiddlewareAuth {
    auth(_: Request, __: Response, next: NextFunction): void {
        next()
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh");
    }
}

export class MockDeleteUserUseCase implements DeleteUserUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for DeleteUserUseCase");
    }
}

export class MockSearchUsersUseCase implements SearchUsersUseCase {
    execute(): Promise<{ users: UserResponseModel[]; search_info: any; }> {
        throw new Error("Method not implemented for SearchUsersUseCase");
    }
}
