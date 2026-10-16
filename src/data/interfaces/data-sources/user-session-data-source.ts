import { UserSessionModel } from "../../../domain/entities/auth";

export interface UserSessionDataSource {
    create(session: UserSessionModel): Promise<void>;
    getOne(session_id: string): Promise<UserSessionModel | null>;
    updateExpiration(session_id: string, expiration_utc_date_time: string): Promise<number>;
    revoke(session_id: string, revocation_utc_date_time: string): Promise<number>;
    revokeAllOfUser(user_id: number, revocation_utc_date_time: string, except_session_id?: string): Promise<number>;
    // Removes the sessions that expired or were revoked before the given date
    deleteEndedBefore(utc_date_time: string): Promise<number>;
}
