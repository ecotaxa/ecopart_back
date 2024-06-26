import { ChangeCredentialsModel, DecodedToken } from "../../entities/auth"
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ChangePasswordUseCase } from "../../interfaces/use-cases/auth/change-password";

export class ChangePassword implements ChangePasswordUseCase {
    userRepository: UserRepository

    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(current_user: DecodedToken, credentials: ChangeCredentialsModel): Promise<void> {
        let nb_of_updated_user: number = 0

        // User should not be deleted
        await this.userRepository.ensureUserCanBeUsed(credentials.user_id);
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Admin can update anyone password without old password
        if (await this.userRepository.isAdmin(current_user.user_id)) {
            nb_of_updated_user = await this.userRepository.changePassword(credentials)
            if (nb_of_updated_user == 0) throw new Error("Cannot change password");
        } else if (current_user.user_id == credentials.user_id) {
            // Check if new password exist and is different from old password
            if (!credentials.password || credentials.password === credentials.new_password) throw new Error("New password must be different from old password");
            // Check if old password is correct
            const verifyed = await this.userRepository.verifyUserLogin({ email: current_user.email, password: credentials.password })
            if (verifyed) {
                nb_of_updated_user = await this.userRepository.changePassword(credentials)
                if (nb_of_updated_user == 0) throw new Error("Cannot change password");
            } else {
                throw new Error("Invalid credentials");
            }
        } else {
            throw new Error("Logged user cannot update this property or user");
        }
    }
}