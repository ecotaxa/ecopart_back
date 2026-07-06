import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { PerImageRecord, SampleSourceQcMetadata } from "../../../../src/domain/entities/sample-qc-graph";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { GetSampleQcGraphs } from "../../../../src/domain/use-cases/sample/get-sample-qc-graphs";
import { PreviewSamplesQcGraphs } from "../../../../src/domain/use-cases/sample/preview-samples-qc-graphs";

/* Invariant: for the same sample, the pre-import preview (read from the source folder) and the
 * post-import GET qc-graphs (read from per-sample storage) must return the SAME graphs — they
 * share buildSampleQcGraphs and the import copies the raw files unchanged. Only sample_id and
 * visual_qc_status_label legitimately differ. This guards the shared-builder design from drift. */

const current_user: UserUpdateModel = { user_id: 1 };

async function postImportGraphs(instrument_model: string, records: PerImageRecord[], meta: SampleSourceQcMetadata) {
    const userRepo = new MockUserRepository();
    const sampleRepo = new MockSampleRepository();
    const projectRepo = new MockProjectRepository();
    const privilegeRepo = new MockPrivilegeRepository();
    const useCase = new GetSampleQcGraphs(userRepo, sampleRepo, projectRepo, privilegeRepo);

    jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(userRepo, "isAdmin").mockResolvedValue(true);
    jest.spyOn(privilegeRepo, "isGranted").mockResolvedValue(true);
    jest.spyOn(projectRepo, "getProject").mockResolvedValue({ project_id: 1, instrument_model } as any);
    // The DB sample carries the same filter/settings the source metadata does (populated at import).
    jest.spyOn(sampleRepo, "getSample").mockResolvedValue({
        sample_id: 42,
        sample_name: "s1",
        project_id: 1,
        visual_qc_status_label: "VALIDATED",
        sample_type_label: meta.sample_type_label,
        filter_first_image: meta.filter_first_image,
        filter_last_image: meta.filter_last_image,
        instrument_settings_depth_offset_m: meta.instrument_settings_depth_offset_m,
        instrument_settings_image_volume_l: meta.instrument_settings_image_volume_l,
    } as PublicSampleModel);
    jest.spyOn(sampleRepo, "getPerImageRecords").mockResolvedValue(records);

    return useCase.execute(current_user, 1, 42);
}

async function preImportGraphs(instrument_model: string, records: PerImageRecord[], meta: SampleSourceQcMetadata) {
    const userRepo = new MockUserRepository();
    const sampleRepo = new MockSampleRepository();
    const projectRepo = new MockProjectRepository();
    const privilegeRepo = new MockPrivilegeRepository();
    const useCase = new PreviewSamplesQcGraphs(userRepo, sampleRepo, projectRepo, privilegeRepo, "fss/");

    jest.spyOn(userRepo, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(userRepo, "isAdmin").mockResolvedValue(true);
    jest.spyOn(privilegeRepo, "isGranted").mockResolvedValue(true);
    jest.spyOn(projectRepo, "getProject").mockResolvedValue({ project_id: 1, root_folder_path: "root", instrument_model } as any);
    jest.spyOn(sampleRepo, "ensureFolderExists").mockResolvedValue();
    jest.spyOn(sampleRepo, "listImportableSamples").mockResolvedValue([{ sample_name: "s1" } as any]);
    jest.spyOn(sampleRepo, "getPerImageRecordsFromSource").mockResolvedValue(records);
    jest.spyOn(sampleRepo, "getSourceFilterMetadata").mockResolvedValue(meta);

    const res = await useCase.execute(current_user, 1, ["s1"]);
    return res[0];
}

function graphsOnly(payload: any) {
    // Drop the two fields that are meant to differ between preview and post-import.
    const { sample_id, visual_qc_status_label, ...rest } = payload;
    return rest;
}

describe("QC graphs parity: pre-import preview === post-import", () => {
    test("UVP5 (integer ids, with a gap)", async () => {
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "10", raw_pressure: 100, light_on: true, spectrum_counts: { 1: 5 } },
            { image_index: 1, image_id: "11", raw_pressure: 110, light_on: true, spectrum_counts: { 1: 6 } },
            { image_index: 2, image_id: "14", raw_pressure: 140, light_on: true, spectrum_counts: { 1: 7 } },
        ];
        const meta: SampleSourceQcMetadata = {
            filter_first_image: "11",
            filter_last_image: "14",
            instrument_settings_image_volume_l: 1,
            instrument_settings_depth_offset_m: null,
            sample_type_label: "Depth",
        };

        const post = await postImportGraphs("UVP5HD", records, meta);
        const pre = await preImportGraphs("UVP5HD", records, meta);

        // sample_id / status differ as designed; everything else (all 3 graphs + filtering) matches.
        expect(post.sample_id).toBe(42);
        expect(pre.sample_id).toBeNull();
        expect(post.visual_qc_status_label).toBe("VALIDATED");
        expect(pre.visual_qc_status_label).toBe("NOT_IMPORTED");
        expect(graphsOnly(pre)).toEqual(graphsOnly(post));
    });

    test("UVP6 (timestamp ids, with a black frame)", async () => {
        const records: PerImageRecord[] = [
            { image_index: 0, image_id: "20240612-003906-1", raw_pressure: 0.5, light_on: true, spectrum_counts: { 1: 10, 2: 5 } },
            { image_index: 1, image_id: "20240612-003907-1", raw_pressure: 1.5, light_on: true, spectrum_counts: { 1: 20 } },
            { image_index: 2, image_id: "20240612-003908-1", raw_pressure: 1.7, light_on: false, spectrum_counts: { 1: 3 } },
        ];
        const meta: SampleSourceQcMetadata = {
            filter_first_image: "20240612-003906-1",
            filter_last_image: "20240612-003907-1",
            instrument_settings_image_volume_l: 2,
            instrument_settings_depth_offset_m: 0,
            sample_type_label: "Depth",
        };

        const post = await postImportGraphs("UVP6LP", records, meta);
        const pre = await preImportGraphs("UVP6LP", records, meta);

        expect(post.black_profile).not.toBeNull();
        expect(graphsOnly(pre)).toEqual(graphsOnly(post));
    });
});
