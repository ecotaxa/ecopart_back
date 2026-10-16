
import { DecodedToken } from "../../entities/auth";
import { UserResponseModel } from "../../entities/user";
export interface AuthRepository {
    generateAccessToken(user: UserResponseModel, session_id?: string): string;
    generateRefreshToken(user: UserResponseModel, session_id: string): string;
    // The refresh token from a cookie, verified, or null when invalid or expired
    decodeRefreshToken(token: string): DecodedToken | null;
    createSession(user_id: number): Promise<string>;
    // Throws "Session revoked or expired" unless the session exists, belongs to the user and is still valid
    ensureSessionIsActive(session_id: string | undefined, user_id: number): Promise<void>;
    extendSession(session_id: string): Promise<void>;
    revokeSession(session_id: string): Promise<void>;
    revokeUserSessions(user_id: number, except_session_id?: string): Promise<number>;
    purgeEndedSessions(): Promise<number>;
}
