import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { BroadcastMessageRepository } from "../../interfaces/repositories/broadcast_message-repository";
import { DeleteBroadcastMessageUseCase } from "../../interfaces/use-cases/broadcast_message/delete-broadcast-message";

export class DeleteBroadcastMessage implements DeleteBroadcastMessageUseCase {
    userRepository: UserRepository;
    broadcastMessageRepository: BroadcastMessageRepository;

    constructor(userRepository: UserRepository, broadcastMessageRepository: BroadcastMessageRepository) {
        this.userRepository = userRepository;
        this.broadcastMessageRepository = broadcastMessageRepository;
    }

    async execute(current_user: UserUpdateModel): Promise<void> {
        // Authorization: only an admin (whose account is usable) may clear the broadcast message.
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) throw new Error("Logged user cannot manage broadcast messages");

        await this.broadcastMessageRepository.deleteMessage();
    }
}
