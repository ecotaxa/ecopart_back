import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { ProjectResponseModel, ProjectUpdateModel } from "../../../../src/domain/entities/project";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { DeleteProject } from '../../../../src/domain/use-cases/project/delete-project'
import { projectResponseModel } from "../../../entities/project";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";

describe("Delete Project Use Case", () => {

    let mockProjectRepository: ProjectRepository;
    let mockUserRepository: UserRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockProjectRepository = new MockProjectRepository()
        mockUserRepository = new MockUserRepository()
    })


    test("User is not admin : delete a project : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const project_to_delete: ProjectUpdateModel = {
            project_id: 1
        }
        const preexistent_project: ProjectResponseModel = projectResponseModel


        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(preexistent_project))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockProjectRepository, "deleteProject").mockImplementation(() => Promise.resolve(1))

        const deleteProjectUseCase = new DeleteProject(mockUserRepository, mockProjectRepository)
        await deleteProjectUseCase.execute(current_user, project_to_delete);

        expect(mockProjectRepository.getProject).toBeCalledWith(project_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockProjectRepository.deleteProject).toBeCalledWith(project_to_delete);
    });



    test("User is admin : delete a project : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const project_to_delete: ProjectUpdateModel = {
            project_id: 1
        }
        const preexistent_project: ProjectResponseModel = projectResponseModel


        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(preexistent_project))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockProjectRepository, "deleteProject").mockImplementation(() => Promise.resolve(1))

        const deleteProjectUseCase = new DeleteProject(mockUserRepository, mockProjectRepository)
        await deleteProjectUseCase.execute(current_user, project_to_delete);

        expect(mockProjectRepository.getProject).toBeCalledWith(project_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockProjectRepository.deleteProject).toBeCalledWith(project_to_delete);
    });


    // Other failing scenarios
    test("Current user is deleted", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const project_to_delete: ProjectUpdateModel = {
            project_id: 2
        }

        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockProjectRepository, "getProject")
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockProjectRepository, "deleteProject")

        const deleteProjectUseCase = new DeleteProject(mockUserRepository, mockProjectRepository)
        try {
            await deleteProjectUseCase.execute(current_user, project_to_delete);
        } catch (err) {
            expect(err.message).toBe("User is deleted");
        }


        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockProjectRepository.getProject).not.toBeCalled();
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockProjectRepository.deleteProject).not.toBeCalled();
    });

    test("Can't find project to delete", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const project_to_delete: ProjectUpdateModel = {
            project_id: 2
        }

        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockProjectRepository, "deleteProject")

        const deleteProjectUseCase = new DeleteProject(mockUserRepository, mockProjectRepository)

        try {
            await deleteProjectUseCase.execute(current_user, project_to_delete);
        } catch (err) {
            expect(err.message).toBe("Can't find project to delete");
        }

        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockProjectRepository.getProject).toBeCalledWith(project_to_delete);
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockProjectRepository.deleteProject).not.toBeCalled();
    });



    test("Can't delete project", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const project_to_delete: ProjectUpdateModel = {
            project_id: 2
        }
        const preexistent_project: ProjectResponseModel = projectResponseModel

        jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(preexistent_project))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockProjectRepository, "deleteProject").mockImplementation(() => Promise.resolve(0))

        const deleteProjectUseCase = new DeleteProject(mockUserRepository, mockProjectRepository)
        try {
            await deleteProjectUseCase.execute(current_user, project_to_delete);
        } catch (err) {
            expect(err.message).toBe("Can't delete project");
        }
        expect(mockProjectRepository.getProject).toBeCalledWith(project_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockProjectRepository.deleteProject).toBeCalledWith(project_to_delete);
    });


})