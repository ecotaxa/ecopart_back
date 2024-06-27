import { UserUpdateModel, UserResponseModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { UpdateUserUseCase } from "../../interfaces/use-cases/user/update-user";

export class UpdateUser implements UpdateUserUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(current_user: UserUpdateModel, user_to_update: UserUpdateModel): Promise<UserResponseModel> {
        let nb_of_updated_user: number = 0

        // User should not be deleted
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const user = await this.userRepository.getUser({ user_id: user_to_update.user_id })
        if (!user) throw new Error("Cannot find user to update");
        if (user.deleted !== undefined) throw new Error("User to update is deleted");

        // Update admin can update anyone 
        if (await this.userRepository.isAdmin(current_user.user_id)) {
            nb_of_updated_user = await this.userRepository.adminUpdateUser(user_to_update)
            if (nb_of_updated_user == 0) throw new Error("Cannot update user");
        } else if (current_user.user_id == user_to_update.user_id) {
            // Update classic only on himself 
            nb_of_updated_user = await this.userRepository.standardUpdateUser(user_to_update)
            if (nb_of_updated_user == 0) throw new Error("Cannot update user");
        } else {
            throw new Error("Logged user cannot update this property or user");
        }

        const updated_user = await this.userRepository.getUser({ user_id: user_to_update.user_id })
        if (!updated_user) throw new Error("Cannot find updated user");

        const publicUser = this.userRepository.toPublicUser(updated_user)
        return publicUser
    }
}