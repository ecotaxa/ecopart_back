import { DecodedToken } from "../../src/domain/entities/auth";

export const decodedToken: DecodedToken = {
    user_id: 1,
    last_name: "Smith",
    first_name: "John",
    email: "john@gmail.com",
    valid_email: false,
    confirmation_code: "123456",
    is_admin: false,
    organisation: "LOV",
    country: "France",
    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    user_creation_date: '2023-08-01 10:30:00',

    iat: 1693237789,
    exp: 1724795389
}
//TODO: add more entities to test