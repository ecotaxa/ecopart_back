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