import { UserUpdateModel, UserResponseModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { UpdateUserUseCase } from "../../interfaces/use-cases/user/update-user";

export class UpdateUser implements UpdateUserUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(current_user: UserUpdateModel, user_to_update: UserUpdateModel): Promise<UserResponseModel> {
        let nb_of_updated_user: number | null = null

        // update admin can update anyone 
        if (await this.userRepository.isAdmin(current_user.id)) {
            nb_of_updated_user = await this.userRepository.adminUpdateUser(user_to_update)
            if (!nb_of_updated_user || nb_of_updated_user == 0) throw new Error("Can't update user");
        } else if (current_user.id == user_to_update.id) {
            // update classic only on himself 
            nb_of_updated_user = await this.userRepository.standardUpdateUser(user_to_update)
            if (!nb_of_updated_user || nb_of_updated_user == 0) throw new Error("Can't update user");
            // TODO RETURN ERROR CODE Forbidden (403), Unauthorized (401)...
        } else {
            throw new Error("Forbidden");
        }

        const updated_user = await this.userRepository.getUser({ id: user_to_update.id })
        if (!updated_user) throw new Error("Can't find updated user");

        return updated_user
    }
}