import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { ProjectResponseModel, PublicProjectResponseModel } from "../../../../src/domain/entities/project";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { GetProject } from "../../../../src/domain/use-cases/project/get-project";
import { projectResponseModel } from "../../../entities/project";
import { publicPrivilegesResponse_WithMemberAndManager } from "../../../entities/privilege";

let mockUserRepository: UserRepository;
let mockProjectRepository: ProjectRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let useCase: GetProject;

const current_user: UserUpdateModel = { user_id: 7 };
const stored_project = { project_id: 1, root_folder_path: "folder", privacy_duration: 1200 } as ProjectResponseModel;
const public_project: PublicProjectResponseModel = { ...projectResponseModel, privacy_status: "private", root_folder_path: "folder", last_backup_utc_date_time: "2026-01-01" };

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockProjectRepository = new MockProjectRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    useCase = new GetProject(mockUserRepository, mockProjectRepository, mockPrivilegeRepository);

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
    jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(stored_project);
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockResolvedValue(publicPrivilegesResponse_WithMemberAndManager);
    jest.spyOn(mockProjectRepository, "toPublicProject").mockReturnValue(public_project);
});

describe("GetProject", () => {
    test("a user outside a private project still gets its metadata, without the import folder or the backup date", async () => {
        const res = await useCase.execute(current_user, { project_id: 1 });

        expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 1 });
        expect(mockProjectRepository.toPublicProject).toBeCalledWith(stored_project, publicPrivilegesResponse_WithMemberAndManager);
        expect(res).not.toHaveProperty("root_folder_path");
        expect(res).not.toHaveProperty("last_backup_utc_date_time");
        expect(res.privacy_status).toBe("private");
        expect(res.managers).toStrictEqual(public_project.managers);
        expect(res.project_title).toBe(public_project.project_title);
    });

    test.each([
        ["a member", () => jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true)],
        ["a manager", () => jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValue(true)],
        ["an admin", () => jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)],
    ])("%s gets the full project", async (_label, grant) => {
        grant();

        const res = await useCase.execute(current_user, { project_id: 1 });

        expect(res).toStrictEqual(public_project);
    });

    test("stops when the user cannot be used", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));

        await expect(useCase.execute(current_user, { project_id: 1 })).rejects.toThrow("User cannot be used");
        expect(mockProjectRepository.getProject).toBeCalledTimes(0);
    });

    test("throws when the project does not exist", async () => {
        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(null);

        await expect(useCase.execute(current_user, { project_id: 1 })).rejects.toThrow("Cannot find project");
        expect(mockPrivilegeRepository.getPublicPrivileges).toBeCalledTimes(0);
    });

    test("throws when the privileges cannot be found", async () => {
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockResolvedValue(null);

        await expect(useCase.execute(current_user, { project_id: 1 })).rejects.toThrow("Cannot find privileges");
    });
});
