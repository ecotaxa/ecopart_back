//test/domain/repositories/auth-repository.test.ts
import { JwtPayload } from "jsonwebtoken";
import { AuthRepository } from "../../../src/domain/interfaces/repositories/auth-repository";
import { AuthRepositoryImpl } from "../../../src/domain/repositories/auth-repository";
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken";

class MockJwtAdapter extends JwtAdapter {
    sign(): string {
        throw new Error("Method not implemented.");
    }
    verify(): JwtPayload | string {
        throw new Error("Method not implemented.");
    }
}


const TEST_ACCESS_TOKEN_SECRET = process.env.TEST_ACCESS_TOKEN_SECRET || ''
const TEST_REFRESH_TOKEN_SECRET = process.env.TEST_REFRESH_TOKEN_SECRET || ''

describe("Auth Repository", () => {
    let authRepository: AuthRepository
    let jwt: JwtAdapter

    beforeEach(() => {
        jest.clearAllMocks();
        jwt = new MockJwtAdapter()
        authRepository = new AuthRepositoryImpl(jwt, TEST_ACCESS_TOKEN_SECRET, TEST_REFRESH_TOKEN_SECRET)
    })

    describe("test generateAccessToken", () => {
        test("should return valid access token", async () => {
            const InputData = {
                id: 1,
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                status: "Pending",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            const expectedData = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3ROYW1lIjoiSm9obiIsImxhc3ROYW1lIjoiU21pdGgiLCJlbWFpbCI6ImpvaG5AZ21haWwuY29tIiwic3RhdHVzIjoiUGVuZGluZyIsIm9yZ2FuaXNhdGlvbiI6IkxPViIsImNvdW50cnkiOiJGcmFuY2UiLCJ1c2VyX3BsYW5uZWRfdXNhZ2UiOiJNb24gdXNhZ2UiLCJ1c2VyX2NyZWF0aW9uX2RhdGUiOiIyMDIzLTA3LTMxIDE3OjE4OjQ3IiwiaWF0IjoxNjkzNDA2MDI3LCJleHAiOjE2OTM0MDc4Mjd9.pES4WXEsoN9QBo5OBoy3NmFW02OcvC8KyPT1E0zBRog"
            jest.spyOn(jwt, "sign").mockImplementation(() => { return expectedData })
            const result = authRepository.generateAccessToken(InputData);
            expect(result).toBe(expectedData)
        });
    })

    describe("test generateRefreshToken", () => {
        test("should return valid Refresh", async () => {
            const InputData = {
                id: 1,
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                status: "Pending",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            const expectedData = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3ROYW1lIjoiSm9obiIsImxhc3ROYW1lIjoiU21pdGgiLCJlbWFpbCI6ImpvaG5AZ21haWwuY29tIiwic3RhdHVzIjoiUGVuZGluZyIsIm9yZ2FuaXNhdGlvbiI6IkxPViIsImNvdW50cnkiOiJGcmFuY2UiLCJ1c2VyX3BsYW5uZWRfdXNhZ2UiOiJNb24gdXNhZ2UiLCJ1c2VyX2NyZWF0aW9uX2RhdGUiOiIyMDIzLTA3LTMxIDE3OjE4OjQ3IiwiaWF0IjoxNjkzNDA2MDI3LCJleHAiOjE2OTM0MDc4Mjd9.pES4WXEsoN9QBo5OBoy3NmFW02OcvC8KyPT1E0zBRog"
            jest.spyOn(jwt, "sign").mockImplementation(() => { return expectedData })
            const result = authRepository.generateRefreshToken(InputData);
            expect(result).toBe(expectedData)
        });
    })
})