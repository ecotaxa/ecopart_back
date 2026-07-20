import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { AdminStatsResponseModel, StatsPeriodOptions } from "../../../../src/domain/entities/stats";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { StatsRepository } from "../../../../src/domain/interfaces/repositories/stats-repository";
import { GetStats } from "../../../../src/domain/use-cases/admin/get-stats";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockStatsRepository } from "../../../mocks/stats-mock";

describe("GetStats Use Case", () => {
    let mockUserRepository: UserRepository;
    let mockStatsRepository: StatsRepository;
    let getStatsUseCase: GetStats;

    const admin: UserUpdateModel = { user_id: 1 };
    const options: StatsPeriodOptions = { from: "2026-01-01", to: "2026-03-31", granularity: "month" };

    const expectedStats: AdminStatsResponseModel = {
        generated_at: "2026-07-20T09:00:00.000Z",
        totals: {
            users: { total: 42, admins: 2, validated_email: 38, pending_validation: 4, deleted: 5, distinct_organisations: 9 },
            projects: { total: 12, backed_up: 7, linked_to_ecotaxa: 10, by_instrument: [{ label: "UVP6LP", count: 8 }] },
            tasks: { total: 130, exports: 30, imports: 60, running: 1, failed: 4, by_type: [{ label: "EXPORT", count: 30 }], by_status: [{ label: "DONE", count: 125 }] },
            samples: { total: 540, imported_to_ecotaxa: 300, by_qc_status: [{ label: "VALIDATED", count: 480 }] },
            storage: { total_size_bytes: 123456789 },
            top_organisations: [{ organisation: "LOV", users: 12 }],
        },
        period: {
            from: "2026-01-01", to: "2026-03-31T23:59:59.999Z", granularity: "month",
            new_users: 3, new_projects: 2, new_samples: 40,
            tasks: { total: 25, exports: 6, by_type: [{ label: "EXPORT", count: 6 }], by_status: [{ label: "DONE", count: 25 }] },
            baseline: { projects: 10, samples: 500, data_size_bytes: 100000000 },
            series: [
                { interval: "2026-01", projects_created: 2, samples_created: 40, data_size_bytes: 23456789, cumulative_projects: 12, cumulative_samples: 540, cumulative_data_size_bytes: 123456789 },
            ],
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockStatsRepository = new MockStatsRepository();
        getStatsUseCase = new GetStats(mockUserRepository, mockStatsRepository);
    });

    test("throws when the account cannot be used, without checking admin or fetching stats", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        const isAdminSpy = jest.spyOn(mockUserRepository, "isAdmin");
        const statsSpy = jest.spyOn(mockStatsRepository, "getGlobalStats");

        await expect(getStatsUseCase.execute(admin, options)).rejects.toStrictEqual(new Error("User cannot be used"));
        expect(isAdminSpy).not.toBeCalled();
        expect(statsSpy).not.toBeCalled();
    });

    test("throws when the current user is not an admin, without fetching stats", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
        const statsSpy = jest.spyOn(mockStatsRepository, "getGlobalStats");

        await expect(getStatsUseCase.execute(admin, options)).rejects.toStrictEqual(new Error("Logged user cannot access statistics"));
        expect(statsSpy).not.toBeCalled();
    });

    test("returns the stats for an admin and forwards the period options", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
        const statsSpy = jest.spyOn(mockStatsRepository, "getGlobalStats").mockResolvedValue(expectedStats);

        await expect(getStatsUseCase.execute(admin, options)).resolves.toEqual(expectedStats);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(admin.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(admin.user_id);
        expect(statsSpy).toBeCalledTimes(1);
        expect(statsSpy).toBeCalledWith(options);
    });
});
