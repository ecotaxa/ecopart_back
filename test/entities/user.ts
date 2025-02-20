import { PublicEcotaxaAccountRequestCreationModel, PublicEcotaxaAccountResponseModel } from "../../src/domain/entities/ecotaxa_account";
import { UserRequestCreationModel, UserResponseModel } from "../../src/domain/entities/user";

export const userRequestCreationModel_1: UserRequestCreationModel = {
    last_name: "Smith",
    first_name: "John",
    email: "john@gmail.com",
    password: "test123!",
    organisation: "LOV",
    country: "France",
    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
}
export const userRequestCreationModel_2: UserRequestCreationModel = {
    last_name: "Smith",
    first_name: "John",
    email: "johny@gmail.com",
    password: "test123!",
    organisation: "LOV",
    country: "France",
    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
}

export const validUser: UserResponseModel = {
    user_id: 1,
    last_name: "Smith",
    first_name: "John",
    email: "john@gmail.com",
    valid_email: true,
    is_admin: false,
    organisation: "LOV",
    country: "France",
    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    user_creation_date: '2023-08-01 10:30:00'
}
export const deletedUser: UserResponseModel = {
    user_id: 1,
    last_name: "anonym_1",
    first_name: "anonym_1",
    email: "anonym_1",
    valid_email: false,
    confirmation_code: null,
    is_admin: false,
    organisation: "anonymized",
    country: "anonymized",
    user_planned_usage: "anonymized",
    reset_password_code: null,
    deleted: "2021-08-10T00:00:00.000Z",
    user_creation_date: "121212"
}
export const unvalidUser: UserResponseModel = {
    user_id: 1,
    last_name: "Smith",
    first_name: "John",
    email: "john@gmail.com",
    valid_email: false,
    is_admin: false,
    organisation: "LOV",
    country: "France",
    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    user_creation_date: '2023-08-01 10:30:00'
}

export const public_ecotaxa_request_creation_model_without_ecopart_id: Partial<PublicEcotaxaAccountRequestCreationModel> = {
    ecotaxa_user_login: "lena@gmail.com",
    ecotaxa_user_password: "lena123.",
    ecotaxa_instance_id: 1,
}
export const public_ecotaxa_request_creation_model: PublicEcotaxaAccountRequestCreationModel = {
    ecotaxa_user_login: "lena@gmail.com",
    ecotaxa_user_password: "lena123.",
    ecotaxa_instance_id: 1,
    ecopart_user_id: 1
}


export const public_ecotaxa_account_response_model: PublicEcotaxaAccountResponseModel =
{
    "ecotaxa_account_id": 3,
    "ecotaxa_user_name": "Test API user",
    "ecotaxa_expiration_date": "2025-03-19T16:49:24.892Z",
    "ecotaxa_account_instance_id": 1,
    "ecotaxa_account_instance_name": "FR"
}
