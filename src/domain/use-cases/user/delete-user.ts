import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteUserUseCase } from "../../interfaces/use-cases/user/delete-user";

export class DeleteUser implements DeleteUserUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(current_user: UserUpdateModel, user_to_update: UserUpdateModel): Promise<void> {
        let nb_of_deleted_user: number = 0
        //TODO LATER : check if user_to_update have no progects where he is manager or member
        // const user_to_update_projects = await this.userRepository.getUserProjects(user_to_update.user_id)
        // if (user_to_update_projects.length > 0) throw new Error("User have projects")

        // Check that user to upadate exist
        const user_to_update_exist = await this.userRepository.getUser({ user_id: user_to_update.user_id })
        if (!user_to_update_exist) throw new Error("Can't find user to delete");
        // User should not be deleted
        if (await this.userRepository.isDeleted(user_to_update_exist.user_id)) throw new Error("User is deleted");
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");


        // Check that current_user is admin or is the user to update
        if (await this.userRepository.isAdmin(current_user.user_id) || current_user.user_id == user_to_update.user_id) {
            nb_of_deleted_user = await this.userRepository.deleteUser(user_to_update)
            if (nb_of_deleted_user == 0) throw new Error("Can't delete user");
        } else {
            throw new Error("Logged user cannot delet this user");
        }

        const updated_user = await this.userRepository.getUser({ user_id: user_to_update.user_id })
        console.log(updated_user)
        if (!updated_user) throw new Error("Can't find deleted user");

    }
}