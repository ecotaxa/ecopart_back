import { canonicalMetaHeaderFileName, selectMetaHeaderFile } from "../../../src/domain/utils/meta-header-file";

describe("meta header file", () => {
    describe("canonicalMetaHeaderFileName", () => {
        test("inserts _header_ after the instrument, like legacy EcoPart", () => {
            expect(canonicalMetaHeaderFileName("remote/complex/piqv/backup_ftp_plankton/unzipped/uvp6_sn000171hf_20230720_wcb_1_test"))
                .toBe("uvp6_header_sn000171hf_20230720_wcb_1_test.txt");
            expect(canonicalMetaHeaderFileName("uvp5_sn201_exports01/")).toBe("uvp5_header_sn201_exports01.txt");
        });

        test("is null for a folder name without an underscore", () => {
            expect(canonicalMetaHeaderFileName("data/project")).toBeNull();
        });
    });

    describe("selectMetaHeaderFile", () => {
        test("picks the canonical header next to another deployment's header", () => {
            const files = ["uvp6_header_sn000171hf_20230720_wcb_1.txt", "uvp6_header_sn000171hf_20230720_wcb_1_test.txt"];

            expect(selectMetaHeaderFile(files, "unzipped/uvp6_sn000171hf_20230720_wcb_1_test"))
                .toBe("uvp6_header_sn000171hf_20230720_wcb_1_test.txt");
        });

        test("picks the canonical header next to copies, whatever the listing order", () => {
            const project = "uvp6_sn000104lp/uvp6_sn000104lp_2020_WMO5906623_recovery_profiles_full";
            const files = [
                "uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full_copy20250306.txt",
                "uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full - Copy.txt",
                "uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full.txt",
                "Archives",
            ];

            expect(selectMetaHeaderFile(files, project)).toBe("uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full.txt");
            expect(selectMetaHeaderFile([...files].reverse(), project)).toBe("uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full.txt");
        });

        test("refuses a meta/ folder without the canonical header, even with a single other header", () => {
            const files = ["uvp6_header_sn000007lp_2019_seaglider_test_cscs - Copie.txt", "uvp6_header_sn000007lp_2019_seaglider_test_cscs.xlsx"];

            expect(() => selectMetaHeaderFile(files, "uvp6_sn000007lp_2019_seaglider_test_cscs"))
                .toThrow("Meta header file not found: meta/uvp6_header_sn000007lp_2019_seaglider_test_cscs.txt");
            expect(() => selectMetaHeaderFile(["uvp5_header_sn201_old.txt"], "uvp5_sn201_new"))
                .toThrow("Meta header file not found: meta/uvp5_header_sn201_new.txt");
        });

        test("refuses a project folder that does not follow the naming convention", () => {
            expect(() => selectMetaHeaderFile(["uvp5_header_m197.txt"], "data/source"))
                .toThrow("Meta header file not found: the project folder source is not named <instrument>_<name>");
        });
    });
});
