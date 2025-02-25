import { SearchInfo, SearchResult } from "../../src/domain/entities/search";
import { UserResponseModel } from "../../src/domain/entities/user";
import { EcotaxaAccountModel, EcotaxaAccountResponseModel, EcotaxaInstanceModel, PublicEcotaxaAccountResponseModel } from "../../src/domain/entities/ecotaxa_account";

import { UserRepository } from "../../src/domain/interfaces/repositories/user-repository";
import { EcotaxaAccountRepository } from "../../src/domain/interfaces/repositories/ecotaxa_account-repository";

import { CreateUserUseCase } from "../../src/domain/interfaces/use-cases/user/create-user";
import { UpdateUserUseCase } from "../../src/domain/interfaces/use-cases/user/update-user";
import { ValidUserUseCase } from "../../src/domain/interfaces/use-cases/user/valid-user";
import { DeleteUserUseCase } from "../../src/domain/interfaces/use-cases/user/delete-user";
import { SearchUsersUseCase } from "../../src/domain/interfaces/use-cases/user/search-user";
import { LoginEcotaxaAccountUseCase } from "../../src/domain/interfaces/use-cases/ecotaxa_account/login-ecotaxa_account";
import { LogoutEcotaxaAccountUseCase } from "../../src/domain/interfaces/use-cases/ecotaxa_account/logout-ecotaxa_account";
import { SearchEcotaxaAccountsUseCase } from "../../src/domain/interfaces/use-cases/ecotaxa_account/search-ecotaxa_account";

import { MiddlewareAuth } from "../../src/presentation/interfaces/middleware/auth";

import { Request, Response, NextFunction } from "express";
import { DecodedToken } from "../../src/domain/entities/auth";
import { EcotaxaAccountDataSource } from "../../src/data/interfaces/data-sources/ecotaxa_account-data-source";

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

export class MockEcotaxaAccountRepository implements EcotaxaAccountRepository {
    connectToEcotaxaInstance(): Promise<EcotaxaAccountModel> {
        throw new Error("Method not implemented for connectToEcotaxaInstance.");
    }
    createEcotaxaAccount(): Promise<number> {
        throw new Error("Method not implemented for createEcotaxaAccount.");
    }
    getOneEcoTaxaInstance(): Promise<EcotaxaInstanceModel | null> {
        throw new Error("Method not implemented for getOneEcoTaxaInstance.");
    }
    accountExists(): Promise<boolean> {
        throw new Error("Method not implemented for accountExists.");
    }
    getOneEcotaxaAccount(): Promise<EcotaxaAccountResponseModel | null> {
        throw new Error("Method not implemented for getOneEcotaxaAccount.");
    }
    formatEcotaxaAccountResponse(): PublicEcotaxaAccountResponseModel {
        throw new Error("Method not implemented for formatEcotaxaAccountResponse.");
    }
    deleteEcotaxaAccount(): Promise<number> {
        throw new Error("Method not implemented for deleteEcotaxaAccount.");
    }
    standardGetEcotaxaAccountsModels(): Promise<SearchResult<EcotaxaAccountResponseModel>> {
        throw new Error("Method not implemented for standardGetEcotaxaAccountsModels.");
    }
}
export class MockEcotaxaAccountDataSource implements EcotaxaAccountDataSource {
    create(): Promise<number> {
        throw new Error("Method not implemented for create.");
    }
    getOne(): Promise<EcotaxaAccountResponseModel | null> {
        throw new Error("Method not implemented for getOne.");
    }
    getAll(): Promise<SearchResult<EcotaxaAccountResponseModel>> {
        throw new Error("Method not implemented for getAll.");
    }
    deleteOne(): Promise<number> {
        throw new Error("Method not implemented for deleteOne.");
    }
    getOneEcoTaxaInstance(): Promise<EcotaxaInstanceModel | null> {
        throw new Error("Method not implemented for getOneEcoTaxaInstance.");
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
    execute(): Promise<{ users: UserResponseModel[]; search_info: SearchInfo; }> {
        throw new Error("Method not implemented for SearchUsersUseCase");
    }
}
export class MockLoginEcotaxaAccountUseCase implements LoginEcotaxaAccountUseCase {
    execute(): Promise<PublicEcotaxaAccountResponseModel> {
        throw new Error("Method not implemented for LoginEcotaxaAccountUseCase");
    }
}
export class MockLogoutEcotaxaAccountUseCase implements LogoutEcotaxaAccountUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for LogoutEcotaxaAccountUseCase");
    }
}
export class MockSearchEcotaxaAccountsUseCase implements SearchEcotaxaAccountsUseCase {
    execute(): Promise<{ ecotaxa_accounts: PublicEcotaxaAccountResponseModel[], search_info: SearchInfo }> {
        throw new Error("Method not implemented for SearchEcotaxaAccountsUseCase");
    }
}

