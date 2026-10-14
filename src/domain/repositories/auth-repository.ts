import { randomUUID } from "crypto";
import { DecodedToken } from "../entities/auth";
import { UserResponseModel } from "../entities/user";
import { AuthRepository } from "../interfaces/repositories/auth-repository";
import { UserSessionDataSource } from "../../data/interfaces/data-sources/user-session-data-source";
import { JwtAdapter } from "../../infra/auth/jsonwebtoken";

// The front refreshes the access token on any 401, so a short lifetime costs the user nothing.
export const ACCESS_TOKEN_LIFETIME = '1h'
// A session ends after this many days without any refresh: each refresh pushes the end back.
export const SESSION_LIFETIME_DAYS = 30
export const REFRESH_TOKEN_LIFETIME = `${SESSION_LIFETIME_DAYS}d`
// Ended sessions are kept this long before being removed at startup.
const ENDED_SESSION_RETENTION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export class AuthRepositoryImpl implements AuthRepository {

    jwt: JwtAdapter
    ACCESS_TOKEN_SECRET: string
    REFRESH_TOKEN_SECRET: string
    sessionDataSource: UserSessionDataSource

    constructor(jwtAdapter: JwtAdapter, ACCESS_TOKEN_SECRET: string, REFRESH_TOKEN_SECRET: string, sessionDataSource: UserSessionDataSource) {
        this.jwt = jwtAdapter
        this.ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET
        this.REFRESH_TOKEN_SECRET = REFRESH_TOKEN_SECRET
        this.sessionDataSource = sessionDataSource
    }

    generateAccessToken(user: UserResponseModel, session_id?: string): string {
        return this.jwt.sign(this.toTokenPayload(user, session_id), this.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_LIFETIME })
    }
    generateRefreshToken(user: UserResponseModel, session_id: string): string {
        return this.jwt.sign(this.toTokenPayload(user, session_id), this.REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_LIFETIME })
    }

    decodeRefreshToken(token: string): DecodedToken | null {
        try {
            return this.jwt.verify(token, this.REFRESH_TOKEN_SECRET) as DecodedToken
        } catch {
            return null
        }
    }

    async createSession(user_id: number): Promise<string> {
        const now = new Date()
        const session_id = randomUUID()
        await this.sessionDataSource.create({
            session_id,
            user_id,
            session_creation_utc_date_time: now.toISOString(),
            session_expiration_utc_date_time: new Date(now.getTime() + SESSION_LIFETIME_DAYS * DAY_MS).toISOString(),
            session_revocation_utc_date_time: null,
        })
        return session_id
    }

    async ensureSessionIsActive(session_id: string | undefined, user_id: number): Promise<void> {
        // Tokens issued before sessions existed carry no session id: refused, the user logs in again once.
        const session = session_id ? await this.sessionDataSource.getOne(session_id) : null
        if (!session
            || session.user_id !== user_id
            || session.session_revocation_utc_date_time !== null
            || session.session_expiration_utc_date_time <= new Date().toISOString()) {
            throw new Error("Session revoked or expired")
        }
    }

    async extendSession(session_id: string): Promise<void> {
        await this.sessionDataSource.updateExpiration(session_id, new Date(Date.now() + SESSION_LIFETIME_DAYS * DAY_MS).toISOString())
    }

    async revokeSession(session_id: string): Promise<void> {
        await this.sessionDataSource.revoke(session_id, new Date().toISOString())
    }

    async revokeUserSessions(user_id: number, except_session_id?: string): Promise<number> {
        return this.sessionDataSource.revokeAllOfUser(user_id, new Date().toISOString(), except_session_id)
    }

    async purgeEndedSessions(): Promise<number> {
        return this.sessionDataSource.deleteEndedBefore(new Date(Date.now() - ENDED_SESSION_RETENTION_DAYS * DAY_MS).toISOString())
    }

    // A JWT is only signed, not encrypted: single-use codes and admin-only lists must not travel in it.
    private toTokenPayload(user: UserResponseModel, session_id?: string): object {
        const { confirmation_code, reset_password_code, managing_projects, member_projects, ...payload } = user
        return session_id ? { ...payload, sid: session_id } : payload
    }

}
