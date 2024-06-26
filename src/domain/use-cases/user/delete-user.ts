import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteUserUseCase } from "../../interfaces/use-cases/user/delete-user";

export class DeleteUser implements DeleteUserUseCase {
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    constructor(userRepository: UserRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
    }

    async execute(current_user: UserUpdateModel, user_to_update: UserUpdateModel): Promise<void> {
        let nb_of_deleted_user: number = 0
        //TODO LATER : check if user_to_update have no progects where he is manager or member
        // const user_to_update_projects = await this.userRepository.getUserProjects(user_to_update.user_id)

        // User should not be deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Check that user to upadate exist
        const user_to_update_exist = await this.userRepository.getUser({ user_id: user_to_update.user_id })
        if (!user_to_update_exist) throw new Error("Cannot find user to delete");
        // User should not be deleted
        if (user_to_update_exist.deleted) throw new Error("User is deleted");


        // Check that current_user is admin or is the user to update
        if (await this.userRepository.isAdmin(current_user.user_id) || current_user.user_id == user_to_update.user_id) {
            nb_of_deleted_user = await this.userRepository.deleteUser(user_to_update)
            if (nb_of_deleted_user == 0) throw new Error("Cannot delete user");
            await this.privilegeRepository.deletePrivileges({ user_id: user_to_update.user_id })
        } else {
            throw new Error("Logged user cannot delet this user");
        }

    }
}
