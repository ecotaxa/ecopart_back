import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { BroadcastMessageResponseModel, MessageLevel } from "../../../../src/domain/entities/broadcast_message";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { BroadcastMessageRepository } from "../../../../src/domain/interfaces/repositories/broadcast_message-repository";
import { GetBroadcastMessage } from "../../../../src/domain/use-cases/broadcast_message/get-broadcast-message";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockBroadcastMessageRepository } from "../../../mocks/broadcast_message-mock";

describe("GetBroadcastMessage Use Case", () => {
    let mockUserRepository: UserRepository;
    let mockBroadcastMessageRepository: BroadcastMessageRepository;
    let getBroadcastMessageUseCase: GetBroadcastMessage;

    const user: UserUpdateModel = { user_id: 1 };
    const existingMessage: BroadcastMessageResponseModel = {
        broadcast_message_id: 1,
        message: "Scheduled maintenance tonight.",
        sub_message: "Unavailable 22:00-23:00 UTC.",
        level: MessageLevel.Warning,
        created_by_user_id: 42,
        message_creation_utc_date_time: "2026-07-20T21:30:00.000Z",
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockBroadcastMessageRepository = new MockBroadcastMessageRepository();
        getBroadcastMessageUseCase = new GetBroadcastMessage(mockUserRepository, mockBroadcastMessageRepository);
    });

    test("throws when the account cannot be used, without reading the message", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        const getSpy = jest.spyOn(mockBroadcastMessageRepository, "getCurrentMessage");

        await expect(getBroadcastMessageUseCase.execute(user)).rejects.toStrictEqual(new Error("User cannot be used"));
        expect(getSpy).not.toBeCalled();
    });

    test("returns the current message for any usable user (no admin check)", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        const isAdminSpy = jest.spyOn(mockUserRepository, "isAdmin");
        const getSpy = jest.spyOn(mockBroadcastMessageRepository, "getCurrentMessage").mockResolvedValue(existingMessage);

        await expect(getBroadcastMessageUseCase.execute(user)).resolves.toEqual(existingMessage);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(user.user_id);
        expect(isAdminSpy).not.toBeCalled();
        expect(getSpy).toBeCalledTimes(1);
    });

    test("returns null when no message is set", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockBroadcastMessageRepository, "getCurrentMessage").mockResolvedValue(null);

        await expect(getBroadcastMessageUseCase.execute(user)).resolves.toBeNull();
    });
});
