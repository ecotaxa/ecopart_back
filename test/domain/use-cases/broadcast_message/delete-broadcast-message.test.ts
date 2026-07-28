import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { BroadcastMessageRepository } from "../../../../src/domain/interfaces/repositories/broadcast_message-repository";
import { DeleteBroadcastMessage } from "../../../../src/domain/use-cases/broadcast_message/delete-broadcast-message";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockBroadcastMessageRepository } from "../../../mocks/broadcast_message-mock";

describe("DeleteBroadcastMessage Use Case", () => {
    let mockUserRepository: UserRepository;
    let mockBroadcastMessageRepository: BroadcastMessageRepository;
    let deleteBroadcastMessageUseCase: DeleteBroadcastMessage;

    const admin: UserUpdateModel = { user_id: 1 };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockBroadcastMessageRepository = new MockBroadcastMessageRepository();
        deleteBroadcastMessageUseCase = new DeleteBroadcastMessage(mockUserRepository, mockBroadcastMessageRepository);
    });

    test("throws when the account cannot be used, without checking admin or deleting", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        const isAdminSpy = jest.spyOn(mockUserRepository, "isAdmin");
        const deleteSpy = jest.spyOn(mockBroadcastMessageRepository, "deleteMessage");

        await expect(deleteBroadcastMessageUseCase.execute(admin)).rejects.toStrictEqual(new Error("User cannot be used"));
        expect(isAdminSpy).not.toBeCalled();
        expect(deleteSpy).not.toBeCalled();
    });

    test("throws when the current user is not an admin, without deleting", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
        const deleteSpy = jest.spyOn(mockBroadcastMessageRepository, "deleteMessage");

        await expect(deleteBroadcastMessageUseCase.execute(admin)).rejects.toStrictEqual(new Error("Logged user cannot manage broadcast messages"));
        expect(deleteSpy).not.toBeCalled();
    });

    test("deletes the message for an admin", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
        const deleteSpy = jest.spyOn(mockBroadcastMessageRepository, "deleteMessage").mockResolvedValue();

        await expect(deleteBroadcastMessageUseCase.execute(admin)).resolves.toBeUndefined();
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(admin.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(admin.user_id);
        expect(deleteSpy).toBeCalledTimes(1);
    });
});
