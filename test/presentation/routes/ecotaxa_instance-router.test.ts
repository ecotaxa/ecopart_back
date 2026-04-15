import request from "supertest";
import server from '../../../src/server'

import EcoTaxaInstanceRouter from '../../../src/presentation/routers/ecotaxa_instance-router'

import { EcotaxaInstanceModel } from "../../../src/domain/entities/ecotaxa_account";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";

import { GetAllEcoTaxaInstancesUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_instance/get-all-ecotaxa-instances";
import { CreateEcoTaxaInstanceUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_instance/create-ecotaxa-instance";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";

import { Request, Response, NextFunction } from "express";
import { MockGetAllEcoTaxaInstancesUseCase, MockCreateEcoTaxaInstanceUseCase } from "../../mocks/user-mock";
import { ecotaxa_instance_1, ecotaxa_instance_test_ecotaxa } from "../../entities/user";


class MockMiddlewareAuth implements MiddlewareAuth {
    auth(req: Request, __: Response, next: NextFunction): void {
        (req as CustomRequest).token = ({
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            confirmation_code: "123456",
            is_admin: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet.",
            user_creation_date: '2023-08-01 10:30:00',

            iat: 1693237789,
            exp: 1724795389
        } as DecodedToken);
        next();
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh");
    }
}

describe("EcoTaxaInstanceRouter", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockGetAllEcoTaxaInstancesUseCase: GetAllEcoTaxaInstancesUseCase;
    let mockCreateEcoTaxaInstanceUseCase: CreateEcoTaxaInstanceUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth();
        mockGetAllEcoTaxaInstancesUseCase = new MockGetAllEcoTaxaInstancesUseCase();
        mockCreateEcoTaxaInstanceUseCase = new MockCreateEcoTaxaInstanceUseCase();

        server.use("/ecotaxa_instances", EcoTaxaInstanceRouter(
            mockMiddlewareAuth,
            mockGetAllEcoTaxaInstancesUseCase,
            mockCreateEcoTaxaInstanceUseCase
        ))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /ecotaxa_instances", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData: EcotaxaInstanceModel[] = [ecotaxa_instance_1, ecotaxa_instance_test_ecotaxa];

            jest.spyOn(mockGetAllEcoTaxaInstancesUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            const response = await request(server).get("/ecotaxa_instances")

            expect(response.status).toBe(200)
            expect(mockGetAllEcoTaxaInstancesUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });

        test("Should return 200 with empty array", async () => {
            jest.spyOn(mockGetAllEcoTaxaInstancesUseCase, "execute").mockImplementation(() => Promise.resolve([]))
            const response = await request(server).get("/ecotaxa_instances")

            expect(response.status).toBe(200)
            expect(mockGetAllEcoTaxaInstancesUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual([])
        });

        test("Should return 500 with error message : Cannot get EcoTaxa instances", async () => {
            jest.spyOn(mockGetAllEcoTaxaInstancesUseCase, "execute").mockImplementation(() => { throw new Error("Database error") })
            const response = await request(server).get("/ecotaxa_instances")

            expect(response.status).toBe(500)
            expect(mockGetAllEcoTaxaInstancesUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Cannot get EcoTaxa instances"] })
        });
    })

    describe("Tests for POST /ecotaxa_instances", () => {
        test("Should return 201 with created instance", async () => {
            const inputData = {
                ecotaxa_instance_name: "NEW",
                ecotaxa_instance_description: "New instance",
                ecotaxa_instance_url: "https://new-ecotaxa.example.com/"
            };

            jest.spyOn(mockCreateEcoTaxaInstanceUseCase, "execute").mockImplementation(() => Promise.resolve({
                ecotaxa_instance_id: 2,
                ecotaxa_instance_name: "NEW",
                ecotaxa_instance_description: "New instance",
                ecotaxa_instance_creation_date: "2025-03-20T10:00:00.000Z",
                ecotaxa_instance_url: "https://new-ecotaxa.example.com/"
            }))
            const response = await request(server).post("/ecotaxa_instances").send(inputData)

            expect(response.status).toBe(201)
            expect(mockCreateEcoTaxaInstanceUseCase.execute).toBeCalledTimes(1)
            expect(response.body.ecotaxa_instance_id).toBe(2)
            expect(response.body.ecotaxa_instance_name).toBe("NEW")
        });

        test("Should return 403 with error message : User is deleted", async () => {
            jest.spyOn(mockCreateEcoTaxaInstanceUseCase, "execute").mockImplementation(() => { throw new Error("User is deleted") })
            const response = await request(server).post("/ecotaxa_instances").send({
                ecotaxa_instance_name: "NEW",
                ecotaxa_instance_description: "New instance",
                ecotaxa_instance_url: "https://new-ecotaxa.example.com/"
            })

            expect(response.status).toBe(403)
            expect(mockCreateEcoTaxaInstanceUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["User is deleted"] })
        });

        test("Should return 401 with error message : Logged user cannot create an EcoTaxa instance", async () => {
            jest.spyOn(mockCreateEcoTaxaInstanceUseCase, "execute").mockImplementation(() => { throw new Error("Logged user cannot create an EcoTaxa instance") })
            const response = await request(server).post("/ecotaxa_instances").send({
                ecotaxa_instance_name: "NEW",
                ecotaxa_instance_description: "New instance",
                ecotaxa_instance_url: "https://new-ecotaxa.example.com/"
            })

            expect(response.status).toBe(401)
            expect(mockCreateEcoTaxaInstanceUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Logged user cannot create an EcoTaxa instance"] })
        });

        test("Should return 500 with error message : Cannot create EcoTaxa instance", async () => {
            jest.spyOn(mockCreateEcoTaxaInstanceUseCase, "execute").mockImplementation(() => { throw new Error("Unexpected error") })
            const response = await request(server).post("/ecotaxa_instances").send({
                ecotaxa_instance_name: "NEW",
                ecotaxa_instance_description: "New instance",
                ecotaxa_instance_url: "https://new-ecotaxa.example.com/"
            })

            expect(response.status).toBe(500)
            expect(mockCreateEcoTaxaInstanceUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual({ errors: ["Cannot create EcoTaxa instance"] })
        });
    })
})
