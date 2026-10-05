import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { GetSample } from "../../../../src/domain/use-cases/sample/get-sample";
import { sampleModel_1 } from "../../../entities/sample";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let useCase: GetSample;

const current_user: UserUpdateModel = { user_id: 7 };
const sample: PublicSampleModel = { ...sampleModel_1, sample_id: 10, project_id: 1 };

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockSampleRepository = new MockSampleRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    useCase = new GetSample(mockUserRepository, mockSampleRepository, mockPrivilegeRepository);

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
});

describe("GetSample", () => {
    test("returns the sample to a project member", async () => {
        const getSample = jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sample);

        const res = await useCase.execute(current_user, 1, 10);

        expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: 7, project_id: 1 });
        expect(getSample).toBeCalledWith({ sample_id: 10 });
        expect(res).toStrictEqual(sample);
    });

    test("lets an admin get a sample of a project they are not a member of", async () => {
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(sample);

        const res = await useCase.execute(current_user, 1, 10);

        expect(res).toStrictEqual(sample);
    });

    test("stops when the user cannot be used", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        const getSample = jest.spyOn(mockSampleRepository, "getSample");

        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("User cannot be used");
        expect(getSample).toBeCalledTimes(0);
    });

    test("stops when the user has no access to the project", async () => {
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
        const getSample = jest.spyOn(mockSampleRepository, "getSample");

        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("Logged user cannot access this project");
        expect(getSample).toBeCalledTimes(0);
    });

    test("throws when the sample does not exist", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(null);

        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("Cannot find sample");
    });

    test("rejects a sample that does not belong to the project", async () => {
        jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue({ ...sample, project_id: 99 });

        await expect(useCase.execute(current_user, 1, 10)).rejects.toThrow("Sample does not belong to project");
    });
});
