import { DecodedToken } from "../../src/domain/entities/auth";
import { AuthRepository } from "../../src/domain/interfaces/repositories/auth-repository";
import { LogoutUserUseCase } from "../../src/domain/interfaces/use-cases/auth/logout";

export class MockAuthRepository implements AuthRepository {
    generateAccessToken(): string {
        throw new Error("Method not implemented for generateAccessToken");
    }
    generateRefreshToken(): string {
        throw new Error("Method not implemented for generateRefreshToken");
    }
    decodeRefreshToken(): DecodedToken | null {
        throw new Error("Method not implemented for decodeRefreshToken");
    }
    createSession(): Promise<string> {
        throw new Error("Method not implemented for createSession");
    }
    ensureSessionIsActive(): Promise<void> {
        throw new Error("Method not implemented for ensureSessionIsActive");
    }
    extendSession(): Promise<void> {
        throw new Error("Method not implemented for extendSession");
    }
    revokeSession(): Promise<void> {
        throw new Error("Method not implemented for revokeSession");
    }
    revokeUserSessions(): Promise<number> {
        throw new Error("Method not implemented for revokeUserSessions");
    }
    purgeEndedSessions(): Promise<number> {
        throw new Error("Method not implemented for purgeEndedSessions");
    }
}

export class MockLogoutUserUseCase implements LogoutUserUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for execute");
    }
}
