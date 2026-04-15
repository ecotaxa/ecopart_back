import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ListOrganisationsUseCase } from "../../interfaces/use-cases/user/list-organisations";

export class ListOrganisations implements ListOrganisationsUseCase {
    userRepository: UserRepository

    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(): Promise<string[]> {
        return await this.userRepository.getDistinctOrganisations();
    }
}
