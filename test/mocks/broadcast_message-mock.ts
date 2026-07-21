import { BroadcastMessageResponseModel } from "../../src/domain/entities/broadcast_message";
import { BroadcastMessageRepository } from "../../src/domain/interfaces/repositories/broadcast_message-repository";
import { GetBroadcastMessageUseCase } from "../../src/domain/interfaces/use-cases/broadcast_message/get-broadcast-message";
import { SetBroadcastMessageUseCase } from "../../src/domain/interfaces/use-cases/broadcast_message/set-broadcast-message";
import { DeleteBroadcastMessageUseCase } from "../../src/domain/interfaces/use-cases/broadcast_message/delete-broadcast-message";

export class MockBroadcastMessageRepository implements BroadcastMessageRepository {
    getCurrentMessage(): Promise<BroadcastMessageResponseModel | null> {
        throw new Error("Method not implemented : getCurrentMessage");
    }
    setMessage(): Promise<BroadcastMessageResponseModel> {
        throw new Error("Method not implemented : setMessage");
    }
    deleteMessage(): Promise<void> {
        throw new Error("Method not implemented : deleteMessage");
    }
}

export class MockGetBroadcastMessageUseCase implements GetBroadcastMessageUseCase {
    execute(): Promise<BroadcastMessageResponseModel | null> {
        throw new Error("Method not implemented : execute");
    }
}

export class MockSetBroadcastMessageUseCase implements SetBroadcastMessageUseCase {
    execute(): Promise<BroadcastMessageResponseModel> {
        throw new Error("Method not implemented : execute");
    }
}

export class MockDeleteBroadcastMessageUseCase implements DeleteBroadcastMessageUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented : execute");
    }
}
