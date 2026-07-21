import { UserUpdateModel } from "../../entities/user";
import { BroadcastMessageRequestCreationModel, BroadcastMessageResponseModel } from "../../entities/broadcast_message";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { BroadcastMessageRepository } from "../../interfaces/repositories/broadcast_message-repository";
import { SetBroadcastMessageUseCase } from "../../interfaces/use-cases/broadcast_message/set-broadcast-message";

export class SetBroadcastMessage implements SetBroadcastMessageUseCase {
    userRepository: UserRepository;
    broadcastMessageRepository: BroadcastMessageRepository;

    constructor(userRepository: UserRepository, broadcastMessageRepository: BroadcastMessageRepository) {
        this.userRepository = userRepository;
        this.broadcastMessageRepository = broadcastMessageRepository;
    }

    async execute(current_user: UserUpdateModel, message: BroadcastMessageRequestCreationModel): Promise<BroadcastMessageResponseModel> {
        // Authorization: only an admin (whose account is usable) may set the broadcast message.
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) throw new Error("Logged user cannot manage broadcast messages");

        return await this.broadcastMessageRepository.setMessage(current_user.user_id, message);
    }
}
