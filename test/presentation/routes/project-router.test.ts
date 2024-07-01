import request from "supertest";
import server from '../../../src/server'

import ProjectRouter from '../../../src/presentation/routers/project-router'

import { PublicProjectRequestCreationModel, PublicProjectResponseModel } from "../../../src/domain/entities/project";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";
import { SearchInfo } from "../../../src/domain/entities/search";

import { CreateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/create-project";
import { UpdateProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/update-project";
import { DeleteProjectUseCase } from "../../../src/domain/interfaces/use-cases/project/delete-project";
import { SearchProjectsUseCase } from "../../../src/domain/interfaces/use-cases/project/search-project";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { IMiddlewareProjectValidation } from "../../../src/presentation/interfaces/middleware/project-validation";

import { Request, Response, NextFunction } from "express";
import { projectRequestCreationModel, projectResponseModel, projectResponseModelArray, partial_projectUpdateModel } from "../../entities/project";

class MockSearchProjectsUseCase implements SearchProjectsUseCase {
    execute(): Promise<{ projects: PublicProjectResponseModel[], search_info: SearchInfo }> {
        throw new Error("Method not implemented for SearchProjectsUseCase");
    }
}

class MockCreateProjectUseCase implements CreateProjectUseCase {
    execute(): Promise<PublicProjectResponseModel> {
        throw new Error("Method not implemented for CreateProjectUseCase");
    }
}
class MockUpdateProjectUseCase implements UpdateProjectUseCase {
    execute(): Promise<PublicProjectResponseModel> {
        throw new Error("Method not implemented for UpdateProjectUseCase");
    }
}

class MockMiddlewareAuth implements MiddlewareAuth {
    auth(req: Request, __: Response, next: NextFunction): void {
        (req as CustomRequest).token = ({
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
        } as DecodedToken);
        next();
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh");
    }
}

class MockMiddlewareProjectValidation implements IMiddlewareProjectValidation {
    rulesGetProjects = []
    rulesProjectRequestCreationModel = []
    rulesProjectUpdateModel = []
}


class MockDeleteProjectUseCase implements DeleteProjectUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for DeleteProjectUseCase");
    }
}

describe("Project Router", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockMiddlewareProjectValidation: MockMiddlewareProjectValidation;
    let mockCreateProjectUseCase: CreateProjectUseCase;
    let mockUpdateProjectUseCase: UpdateProjectUseCase;
    let mockDeleteProjectUseCase: DeleteProjectUseCase;
    let mockSearchProjectsUseCase: SearchProjectsUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        mockMiddlewareProjectValidation = new MockMiddlewareProjectValidation()
        mockCreateProjectUseCase = new MockCreateProjectUseCase()
        mockUpdateProjectUseCase = new MockUpdateProjectUseCase()
        mockDeleteProjectUseCase = new MockDeleteProjectUseCase()
        mockSearchProjectsUseCase = new MockSearchProjectsUseCase()

        server.use("/projects", ProjectRouter(mockMiddlewareAuth, mockMiddlewareProjectValidation, mockCreateProjectUseCase, mockDeleteProjectUseCase, mockUpdateProjectUseCase, mockSearchProjectsUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /projects", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                projects: projectResponseModelArray,
                search_info: {
                    total: 2,
                    limit: 10,
                    total_on_page: 2,
                    page: 1,
                    pages: 1
                }
            };
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/projects")

            expect(response.status).toBe(200)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)

        });

        test("failed if current user is deleted", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(403)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("failed if unexisting or unauthorized parameters", async () => {
            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters : Unauthorized sort_by: validemail") })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if invalid sorting statement", async () => {
            const expectedResponse = "Invalid sorting statement"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Invalid sorting statement : 'des'") })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)

            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("Get projects fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Cannot get projects"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/projects")

            expect(response.status).toBe(500)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("Tests for POST /projects/searches", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                projects: projectResponseModelArray,
                search_info: {
                    total: 2,
                    limit: 10,
                    total_on_page: 2,
                    page: 1,
                    pages: 1
                }
            };
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(200)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });

        test("failed if current user is deleted", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(403)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("failed if unexisting or unauthorized parameters", async () => {
            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters : Unauthorized sort_by: validemail") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if invalid sorting statement", async () => {
            const expectedResponse = "Invalid sorting statement"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Invalid sorting statement : 'des'") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)

            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if Invalid filter statement ", async () => {
            const expectedResponse = "Invalid filter statement"
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error("Invalid filter statement Value for operator 'IN' must be an array in filter: {field: user_id, operator: IN, value:1 } ") })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(401)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("Get users fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Cannot search projects"] }
            jest.spyOn(mockSearchProjectsUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).post("/projects/searches")

            expect(response.status).toBe(500)
            expect(mockSearchProjectsUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("POST /projects", () => {

        test("POST /projects", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
            const OutputData: PublicProjectResponseModel = projectResponseModel

            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).post("/projects").send(InputData)
            expect(response.status).toBe(201)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("POST /projects fail for unexepted reason", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel

            const expectedResponse = { errors: ["Cannot create project"] }

            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error()))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(500)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /projects fail for User is deleted", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
            const expectedResponse = { errors: ["User cannot be used"] }


            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("User cannot be used")))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(403)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });


        test("POST /projects fail for Cannot find created project reason", async () => {
            const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel

            const expectedResponse = { errors: ["Cannot find created project"] }


            jest.spyOn(mockCreateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot find created project")))

            const response = await request(server).post("/projects").send(InputData)

            expect(response.status).toBe(404)
            expect(mockCreateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

    })

    describe("PATCH /projects", () => {

        test("PATCH /projects", async () => {
            const project_to_update = partial_projectUpdateModel

            const OutputData: PublicProjectResponseModel = projectResponseModel

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).patch("/projects/1").send(project_to_update)
            expect(response.status).toBe(200)
        });

        test("PATCH /projects fail for unexepted reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Cannot update project"] }

            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error()))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(500)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("PATCH /projects fail for User is deleted", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["User is deleted"] }


            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("User is deleted")))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(403)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("PATCH /projects fail for Logged user cannot update this property or project reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Logged user cannot update this property or project"] }


            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Logged user cannot update this property or project")))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });


        test("PATCH /projects fail for Cannot find updated project reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Cannot find updated project"] }


            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot find updated project")))
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(404)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("PATCH /projects fail for Unauthorized or unexisting parameters reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters") })
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse))
        });

        test("PATCH /projects fail for Please provide at least one valid parameter to update reason", async () => {
            const project_to_update = partial_projectUpdateModel

            const expectedResponse = { errors: ["Please provide at least one valid parameter to update"] }
            jest.spyOn(mockUpdateProjectUseCase, "execute").mockImplementation(() => { throw new Error("Please provide at least one valid parameter to update") })
            const response = await request(server).patch("/projects/2").send(project_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateProjectUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

    })


    describe("DELETE /projects/:project_id", () => {

        test("DELETE /projects", async () => {
            const expectedResponse = { message: "Project successfully deleted" }

            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /projects fail for User is deleted should return 403", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });


        test("DELETE /projects fail for Cannot find project to delete should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find project to delete"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find project to delete")))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /projects fail for Logged user cannot delete this users should return 401", async () => {
            const expectedResponse = { errors: ["Logged user cannot delete this project"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(Error("Logged user cannot delete this project")))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /projects fail for Cannot delete project should return 500", async () => {
            const expectedResponse = { errors: ["Cannot delete project"] }
            jest.spyOn(mockDeleteProjectUseCase, "execute").mockImplementation(() => Promise.reject(new Error()))
            const response = await request(server).delete("/projects/1")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });

    })

})
