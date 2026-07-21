import { UserUpdateModel } from "../../entities/user";
import { BroadcastMessageResponseModel } from "../../entities/broadcast_message";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { BroadcastMessageRepository } from "../../interfaces/repositories/broadcast_message-repository";
import { GetBroadcastMessageUseCase } from "../../interfaces/use-cases/broadcast_message/get-broadcast-message";

export class GetBroadcastMessage implements GetBroadcastMessageUseCase {
    userRepository: UserRepository;
    broadcastMessageRepository: BroadcastMessageRepository;

    constructor(userRepository: UserRepository, broadcastMessageRepository: BroadcastMessageRepository) {
        this.userRepository = userRepository;
        this.broadcastMessageRepository = broadcastMessageRepository;
    }

    async execute(current_user: UserUpdateModel): Promise<BroadcastMessageResponseModel | null> {
        // Any usable user may read the current message (it is shown to everyone in the front-end).
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        return await this.broadcastMessageRepository.getCurrentMessage();
    }
}
