import { LogoutUser } from "../../../../src/domain/use-cases/auth/logout";
import { MockAuthRepository } from "../../../mocks/auth-mock";

describe("Logout use case", () => {
    let mockAuthRepository: MockAuthRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthRepository = new MockAuthRepository();
        jest.spyOn(mockAuthRepository, "revokeSession").mockImplementation(() => Promise.resolve());
    });

    test("revokes the session of the refresh token", async () => {
        jest.spyOn(mockAuthRepository, "decodeRefreshToken").mockImplementation(() => ({ user_id: 1, sid: "session-1" } as any));
        await new LogoutUser(mockAuthRepository).execute("refresh.token.value");
        expect(mockAuthRepository.decodeRefreshToken).toBeCalledWith("refresh.token.value");
        expect(mockAuthRepository.revokeSession).toBeCalledWith("session-1");
    });

    test("has nothing to revoke without a cookie, with an invalid token or a token without session", async () => {
        jest.spyOn(mockAuthRepository, "decodeRefreshToken")
            .mockImplementationOnce(() => null)
            .mockImplementationOnce(() => ({ user_id: 1 } as any));
        const logout = new LogoutUser(mockAuthRepository);
        await logout.execute(undefined);
        await logout.execute("invalid");
        await logout.execute("legacy.token.without.sid");
        expect(mockAuthRepository.decodeRefreshToken).toBeCalledTimes(2);
        expect(mockAuthRepository.revokeSession).toBeCalledTimes(0);
    });
});
