import { ProjectPrivacyLevel, PublicProjectResponseModel } from "../../../../src/domain/entities/project";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { isProjectActionAllowed, privacyOf, ProjectAccessPolicy, ProjectAction, ProjectRole, restrictProjectView } from "../../../../src/domain/use-cases/project/project-access";
import { projectResponseModel } from "../../../entities/project";

const PRIVACIES: ProjectPrivacyLevel[] = ["private", "visible", "public", "open"];
const ACTIONS: ProjectAction[] = ["see", "figures", "export_particles", "export_ecotaxa", "export_archive", "import", "manage"];

describe("isProjectActionAllowed (privacy x role matrix of the specification)", () => {
    test.each(PRIVACIES)("an admin or a manager may do everything on a %s project", (privacy) => {
        for (const action of ACTIONS) {
            expect(isProjectActionAllowed("admin", privacy, action)).toBe(true);
            expect(isProjectActionAllowed("manager", privacy, action)).toBe(true);
        }
    });

    test.each(PRIVACIES)("a member may do everything but manage a %s project", (privacy) => {
        for (const action of ACTIONS) {
            expect(isProjectActionAllowed("member", privacy, action)).toBe(action !== "manage");
        }
    });

    test.each<[ProjectPrivacyLevel, ProjectAction[]]>([
        ["private", ["see"]],
        ["visible", ["see", "figures"]],
        ["public", ["see", "figures", "export_particles"]],
        ["open", ["see", "figures", "export_particles", "export_ecotaxa"]],
    ])("a user without privilege on a %s project may only: %s", (privacy, allowed) => {
        for (const action of ACTIONS) {
            expect(isProjectActionAllowed("user", privacy, action)).toBe(allowed.includes(action));
        }
    });
});

describe("privacyOf", () => {
    test("reads the status from the creation date and the three delays", () => {
        const project = { project_id: 1, project_creation_utc_date_time: "2026-01-01T00:00:00Z", privacy_duration: 2, visible_duration: 2, public_duration: 2 };
        expect(privacyOf(project, new Date(Date.UTC(2026, 1, 15)))).toBe("private");
        expect(privacyOf(project, new Date(Date.UTC(2026, 3, 15)))).toBe("visible");
        expect(privacyOf(project, new Date(Date.UTC(2026, 5, 15)))).toBe("public");
        expect(privacyOf(project, new Date(Date.UTC(2026, 7, 15)))).toBe("open");
    });
});

describe("restrictProjectView", () => {
    const full: PublicProjectResponseModel = { ...projectResponseModel, privacy_status: "private", root_folder_path: "folder", last_backup_utc_date_time: "2026-01-01" };

    test.each<ProjectRole>(["admin", "manager", "member"])("keeps the full project for a %s", (role) => {
        expect(restrictProjectView(full, role)).toBe(full);
    });

    test("hides the import folder and the backup date from a user outside the project", () => {
        const view = restrictProjectView(full, "user");
        expect(view).not.toHaveProperty("root_folder_path");
        expect(view).not.toHaveProperty("last_backup_utc_date_time");
        expect(view.managers).toStrictEqual(full.managers);
        expect(view.contact).toStrictEqual(full.contact);
        expect(view.privacy_status).toBe("private");
        expect(full.root_folder_path).toBe("folder");
    });
});

describe("ProjectAccessPolicy", () => {
    let mockUserRepository: UserRepository;
    let mockPrivilegeRepository: PrivilegeRepository;
    let policy: ProjectAccessPolicy;
    const now = new Date(Date.UTC(2026, 9, 15));
    const project = (privacy_duration: number, visible_duration = 0, public_duration = 0) =>
        ({ project_id: 3, project_creation_utc_date_time: "2026-10-01T00:00:00Z", privacy_duration, visible_duration, public_duration });

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockPrivilegeRepository = new MockPrivilegeRepository();
        policy = new ProjectAccessPolicy(mockUserRepository, mockPrivilegeRepository);
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    });

    describe("roleOf", () => {
        test("admin before any privilege lookup", async () => {
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            const isManager = jest.spyOn(mockPrivilegeRepository, "isManager");
            expect(await policy.roleOf(7, 3)).toBe("admin");
            expect(isManager).toBeCalledTimes(0);
        });

        test("manager, member, then user", async () => {
            const isManager = jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValueOnce(true).mockResolvedValue(false);
            const isGranted = jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValueOnce(true).mockResolvedValue(false);
            expect(await policy.roleOf(7, 3)).toBe("manager");
            expect(await policy.roleOf(7, 3)).toBe("member");
            expect(await policy.roleOf(7, 3)).toBe("user");
            expect(isManager).toBeCalledWith({ user_id: 7, project_id: 3 });
            expect(isGranted).toBeCalledWith({ user_id: 7, project_id: 3 });
        });
    });

    describe("can", () => {
        test("an admin is never asked for privileges", async () => {
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            const isGranted = jest.spyOn(mockPrivilegeRepository, "isGranted");
            expect(await policy.can(7, project(1200), "manage", now)).toBe(true);
            expect(isGranted).toBeCalledTimes(0);
        });

        test("a project open enough for the action has its privileges left unread", async () => {
            const isGranted = jest.spyOn(mockPrivilegeRepository, "isGranted");
            expect(await policy.can(7, project(0, 1200), "figures", now)).toBe(true);
            expect(isGranted).toBeCalledTimes(0);
        });

        test("a private project asks for a privilege, which a member has", async () => {
            const isGranted = jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValueOnce(true).mockResolvedValue(false);
            expect(await policy.can(7, project(1200), "figures", now)).toBe(true);
            expect(await policy.can(7, project(1200), "figures", now)).toBe(false);
            expect(isGranted).toBeCalledWith({ user_id: 7, project_id: 3 });
        });

        test("managing needs the manager privilege, whatever the privacy", async () => {
            const isManager = jest.spyOn(mockPrivilegeRepository, "isManager").mockResolvedValue(false);
            const isGranted = jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
            expect(await policy.can(7, project(0, 0, 0), "manage", now)).toBe(false);
            expect(isManager).toBeCalledWith({ user_id: 7, project_id: 3 });
            expect(isGranted).toBeCalledTimes(0);
        });

        test("the archive recovery and the import never open up with the privacy", async () => {
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
            expect(await policy.can(7, project(0, 0, 0), "export_archive", now)).toBe(false);
            expect(await policy.can(7, project(0, 0, 0), "import", now)).toBe(false);
            expect(await policy.can(7, project(0, 0, 0), "export_particles", now)).toBe(true);
            expect(await policy.can(7, project(0, 0, 0), "export_ecotaxa", now)).toBe(true);
        });
    });
});
