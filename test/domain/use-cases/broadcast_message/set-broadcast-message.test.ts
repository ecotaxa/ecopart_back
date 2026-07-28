import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { BroadcastMessageRequestCreationModel, BroadcastMessageResponseModel, MessageLevel } from "../../../../src/domain/entities/broadcast_message";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { BroadcastMessageRepository } from "../../../../src/domain/interfaces/repositories/broadcast_message-repository";
import { SetBroadcastMessage } from "../../../../src/domain/use-cases/broadcast_message/set-broadcast-message";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockBroadcastMessageRepository } from "../../../mocks/broadcast_message-mock";

describe("SetBroadcastMessage Use Case", () => {
    let mockUserRepository: UserRepository;
    let mockBroadcastMessageRepository: BroadcastMessageRepository;
    let setBroadcastMessageUseCase: SetBroadcastMessage;

    const admin: UserUpdateModel = { user_id: 1 };
    const input: BroadcastMessageRequestCreationModel = {
        message: "Scheduled maintenance tonight.",
        sub_message: "Unavailable 22:00-23:00 UTC.",
        level: MessageLevel.Warning,
    };
    const stored: BroadcastMessageResponseModel = {
        broadcast_message_id: 1,
        message: input.message,
        sub_message: input.sub_message ?? null,
        level: input.level,
        created_by_user_id: admin.user_id!,
        message_creation_utc_date_time: "2026-07-20T21:30:00.000Z",
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockBroadcastMessageRepository = new MockBroadcastMessageRepository();
        setBroadcastMessageUseCase = new SetBroadcastMessage(mockUserRepository, mockBroadcastMessageRepository);
    });

    test("throws when the account cannot be used, without checking admin or setting", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        const isAdminSpy = jest.spyOn(mockUserRepository, "isAdmin");
        const setSpy = jest.spyOn(mockBroadcastMessageRepository, "setMessage");

        await expect(setBroadcastMessageUseCase.execute(admin, input)).rejects.toStrictEqual(new Error("User cannot be used"));
        expect(isAdminSpy).not.toBeCalled();
        expect(setSpy).not.toBeCalled();
    });

    test("throws when the current user is not an admin, without setting", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
        const setSpy = jest.spyOn(mockBroadcastMessageRepository, "setMessage");

        await expect(setBroadcastMessageUseCase.execute(admin, input)).rejects.toStrictEqual(new Error("Logged user cannot manage broadcast messages"));
        expect(setSpy).not.toBeCalled();
    });

    test("sets the message for an admin and forwards the creator id and input", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
        const setSpy = jest.spyOn(mockBroadcastMessageRepository, "setMessage").mockResolvedValue(stored);

        await expect(setBroadcastMessageUseCase.execute(admin, input)).resolves.toEqual(stored);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(admin.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(admin.user_id);
        expect(setSpy).toBeCalledTimes(1);
        expect(setSpy).toBeCalledWith(admin.user_id, input);
    });
});
