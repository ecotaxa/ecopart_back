import { StoredEcoTaxaStats } from "../../../../src/domain/entities/explore";
import { ProjectQcInputs, buildProjectQcState, buildProjectQcWarnings, storedEcoTaxaSummary } from "../../../../src/domain/use-cases/project/project-stats";
import { LandMask } from "../../../../src/domain/interfaces/geography/land-mask";
import { exploreProject, projectStatsSample } from "../explore/explore-fixtures";

const NOW = new Date("2026-10-23T12:00:00Z");
// Land around Lyon only, the default sample position (Ligurian Sea) at sea.
const LAND: LandMask = { isOnLand: (latitude, longitude) => Math.abs(latitude - 45.76) < 1 && Math.abs(longitude - 4.83) < 1 };

const CLEAN: ProjectQcInputs = {
    raw_backup: { nb_samples_not_backed_up: 0 },
    map: { nb_samples_without_ctd: 0, nb_coordinates_mismatches: 0, nb_samples_on_land: 0 },
    samples: { nb_instrument_parameter_mismatches: 0, nb_suspicious_dates: 0, nb_suspicious_pressures: 0 },
    ecotaxa: { linked: true, nb_samples_not_imported: 0, classification_completed: true },
};

function stored(sample_id: number, counts: Partial<StoredEcoTaxaStats> = {}): StoredEcoTaxaStats {
    return { sample_id, ecotaxa_sample_id: 9000 + sample_id, nb_unclassified: 0, nb_validated: 10, nb_dubious: 0, nb_predicted: 0, used_taxa: [1], fetched_utc_date_time: "2026-10-23T00:00:00.000Z", ...counts };
}

describe("Project QC state builders", () => {
    describe("buildProjectQcWarnings", () => {
        test("no warning for a project whose STATS tab shows none", () => {
            expect(buildProjectQcWarnings(CLEAN)).toEqual([]);
        });

        test("one warning per counter of the STATS tab, in the order of its sections", () => {
            expect(buildProjectQcWarnings({
                raw_backup: { nb_samples_not_backed_up: 4 },
                map: { nb_samples_without_ctd: 3, nb_coordinates_mismatches: 2, nb_samples_on_land: 8 },
                samples: { nb_instrument_parameter_mismatches: 1, nb_suspicious_dates: 5, nb_suspicious_pressures: 6 },
                ecotaxa: { linked: true, nb_samples_not_imported: 7, classification_completed: false },
            })).toEqual([
                { code: "samples_not_backed_up", nb_samples: 4 },
                { code: "samples_without_ctd", nb_samples: 3 },
                { code: "coordinates_mismatches", nb_samples: 2 },
                { code: "samples_on_land", nb_samples: 8 },
                { code: "instrument_parameter_mismatches", nb_samples: 1 },
                { code: "suspicious_dates", nb_samples: 5 },
                { code: "suspicious_pressures", nb_samples: 6 },
                { code: "samples_not_imported_in_ecotaxa", nb_samples: 7 },
                { code: "classification_uncompleted", nb_samples: null },
            ]);
        });

        test("no raw backup warning when the backup state is hidden", () => {
            expect(buildProjectQcWarnings({ ...CLEAN, raw_backup: null })).toEqual([]);
        });

        test("no EcoTaxa warning for a project not linked to EcoTaxa, as its STATS tab hides the section", () => {
            expect(buildProjectQcWarnings({ ...CLEAN, ecotaxa: { linked: false, nb_samples_not_imported: 3, classification_completed: false } })).toEqual([]);
        });
    });

    describe("storedEcoTaxaSummary", () => {
        test("counts the stored stats of the samples imported in EcoTaxa, the others pending", () => {
            const samples = [
                projectStatsSample({ sample_id: 1, ecotaxa_sample_imported: true }),
                projectStatsSample({ sample_id: 2, ecotaxa_sample_imported: true }),
                projectStatsSample({ sample_id: 3, ecotaxa_sample_imported: true }),
                projectStatsSample({ sample_id: 4, ecotaxa_sample_imported: false }),
            ];
            const summary = storedEcoTaxaSummary(samples, [
                stored(1, { nb_validated: 8, nb_predicted: 2 }),
                stored(2, { nb_validated: 0 }),
                stored(4, { nb_validated: 50 }),
            ]);

            expect(summary.objects).toEqual({ total: 10, validated: 8, predicted: 2 });
            expect(summary.nb_samples_with_stats).toBe(1);
            expect(summary.partial).toBe(true);
            expect(summary.nb_samples_pending).toBe(1);
            expect(summary.categories).toEqual([]);
        });
    });

    describe("buildProjectQcState", () => {
        const project = exploreProject(5, "open", { last_backup_utc_date_time: "2024-07-10T00:00:00.000Z" });
        const clean = (overrides = {}) => projectStatsSample({ project_id: 5, ctd_imported: true, ...overrides });

        test("empty without any sample", () => {
            expect(buildProjectQcState(project, [], [], true, LAND, NOW)).toEqual({ project_id: 5, qc_state: "empty", warnings: [] });
        });

        test("ok without any warning", () => {
            expect(buildProjectQcState(project, [clean({ sample_id: 1 }), clean({ sample_id: 2 })], [], true, LAND, NOW))
                .toEqual({ project_id: 5, qc_state: "ok", warnings: [] });
        });

        test("warning with the warnings of the STATS tab", () => {
            const samples = [
                clean({ sample_id: 1, sample_creation_utc_date_time: "2024-07-11T09:00:00.000Z" }),
                clean({ sample_id: 2, ctd_imported: false, max_pressure: null }),
                clean({ sample_id: 3, sample_latitude: 43.4, sample_longitude: 7.87, ctd_latitude: 44.4, ctd_longitude: 7.87, sampling_utc_date_time: "1990-01-01T00:00:00Z" }),
                clean({ sample_id: 4, latitude: 45.76, longitude: 4.83, sample_latitude: 45.76, sample_longitude: 4.83 }),
            ];

            expect(buildProjectQcState(project, samples, [], true, LAND, NOW)).toEqual({
                project_id: 5,
                qc_state: "warning",
                warnings: [
                    { code: "samples_not_backed_up", nb_samples: 1 },
                    { code: "samples_without_ctd", nb_samples: 1 },
                    { code: "coordinates_mismatches", nb_samples: 1 },
                    { code: "samples_on_land", nb_samples: 1 },
                    { code: "suspicious_dates", nb_samples: 1 },
                    { code: "suspicious_pressures", nb_samples: 1 },
                ],
            });
        });

        test("the raw backup warning only when the backup state may be seen", () => {
            const samples = [clean({ sample_id: 1, sample_creation_utc_date_time: "2024-07-11T09:00:00.000Z" })];

            expect(buildProjectQcState(project, samples, [], true, LAND, NOW).warnings).toEqual([{ code: "samples_not_backed_up", nb_samples: 1 }]);
            expect(buildProjectQcState(project, samples, [], false, LAND, NOW)).toEqual({ project_id: 5, qc_state: "ok", warnings: [] });
        });

        test("a linked project is ok once every sample imported in EcoTaxa is fully validated", () => {
            const linked = { ...project, ecotaxa_project_id: 1234, ecotaxa_instance_id: 1 };
            const samples = [clean({ sample_id: 1, ecotaxa_sample_imported: true }), clean({ sample_id: 2, ecotaxa_sample_imported: true })];

            expect(buildProjectQcState(linked, samples, [stored(1), stored(2)], true, LAND, NOW).qc_state).toBe("ok");
            expect(buildProjectQcState(linked, samples, [stored(1), stored(2, { nb_predicted: 3 })], true, LAND, NOW).warnings)
                .toEqual([{ code: "classification_uncompleted", nb_samples: null }]);
            // Stats never read for sample 2: not reported complete, as the STATS tab while it reads them.
            expect(buildProjectQcState(linked, samples, [stored(1)], true, LAND, NOW).warnings)
                .toEqual([{ code: "classification_uncompleted", nb_samples: null }]);
        });

        test("a linked project warns about the samples not imported in EcoTaxa", () => {
            const linked = { ...project, ecotaxa_project_id: 1234, ecotaxa_instance_id: 1 };
            const samples = [clean({ sample_id: 1, ecotaxa_sample_imported: true }), clean({ sample_id: 2 })];

            expect(buildProjectQcState(linked, samples, [stored(1)], true, LAND, NOW).warnings)
                .toEqual([{ code: "samples_not_imported_in_ecotaxa", nb_samples: 1 }]);
        });
    });
});
