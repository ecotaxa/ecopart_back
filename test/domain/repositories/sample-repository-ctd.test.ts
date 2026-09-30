import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";
import { PublicSampleModel } from "../../../src/domain/entities/sample";
import { sampleModel_1 } from "../../entities/sample";

describe("buildCTDDescription", () => {
    const repo = new SampleRepositoryImpl({} as any, "");

    test("numbers only the custom columns, in file order, keeping their original title", () => {
        const content = "Pressure [db]\tpH\tTemperature [degC]\tTurbidity [NTU]\n10\t8.1\t14.2\t0.3\n";

        expect(repo.buildCTDDescription(content)).toBe("01=pH\n02=Turbidity [NTU]");
    });

    test("alternative spellings of standard columns are not custom", () => {
        const content = "pressure in water column [db]\tOxygen [ml/l]\tnitrate [µmol/l]\tpH\r\n10\t5\t2\t8.1\r\n";

        expect(repo.buildCTDDescription(content)).toBe("01=pH");
    });

    test("returns null when every column is standard", () => {
        const content = "pressure [db]\ttemperature [degc]\tqc flag\n10\t14.2\t0\n";

        expect(repo.buildCTDDescription(content)).toBeNull();
    });
});

describe("readCTDCoordinates", () => {
    const repo = new SampleRepositoryImpl({} as any, "");

    test("returns the first row where LAT and LON are both valid, skipping NaN and empty cells", () => {
        const content = "depth [m]\tLAT\tLON\r\n2.51\tNaN\tNaN\r\n2.53\t\t-20.27\r\n2.54\t63.3435665573376\t-20.276459790266\r\n2.60\t63.34\t-20.28\r\n";

        expect(repo.readCTDCoordinates(content)).toEqual({ latitude: 63.3435665573376, longitude: -20.276459790266 });
    });

    test("accepts the long column names, case-insensitively", () => {
        const content = "Pressure [db]\tLatitude\tLongitude\n10\t-45.5\t170.25\n";

        expect(repo.readCTDCoordinates(content)).toEqual({ latitude: -45.5, longitude: 170.25 });
    });

    test("ignores out-of-range values", () => {
        const content = "lat\tlon\n95\t10\n45\t200\n45\t10\n";

        expect(repo.readCTDCoordinates(content)).toEqual({ latitude: 45, longitude: 10 });
    });

    test("returns null when the file has no position columns", () => {
        const content = "Pressure in Water Column [db] \tTemperature [degC]\n6.0\t15.1\n";

        expect(repo.readCTDCoordinates(content)).toBeNull();
    });

    test("returns null when no row has a valid position", () => {
        const content = "pressure [db]\tLAT\tLON\n1\tNaN\tNaN\n2\t63.3\tNaN\n";

        expect(repo.readCTDCoordinates(content)).toBeNull();
    });
});

describe("CTD import / delete sample updates", () => {
    let base_folder: string;
    let dataSource: { getAll: jest.Mock; updateOne: jest.Mock };
    let repo: SampleRepositoryImpl;

    beforeEach(() => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-ctd-"));
        fs.mkdirSync(path.join(base_folder, "project_src", "CTDdata"), { recursive: true });
        fs.writeFileSync(
            path.join(base_folder, "project_src", "CTDdata", "sample_a.ctd"),
            "pressure [db]\tpH\n10\t8.1\n",
            "latin1"
        );
        fs.writeFileSync(
            path.join(base_folder, "project_src", "CTDdata", "sample_b.ctd"),
            "pressure [db]\tLAT\tLON\n10\tNaN\tNaN\n11\t63.3476\t-20.2736\n",
            "latin1"
        );
        dataSource = {
            getAll: jest.fn().mockResolvedValue({ items: [{ sample_id: 7, sample_name: "sample_a", station_id: "st1" }, { sample_id: 8, sample_name: "sample_b", station_id: "st2" }], total: 2 }),
            updateOne: jest.fn().mockResolvedValue(1),
        };
        repo = new SampleRepositoryImpl(dataSource as any, "storage");
        repo.base_folder = base_folder;
    });

    afterEach(() => {
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    test("import records the import task and the custom-column description", async () => {
        await repo.importCTDSamples("project_src", "UVP6HF", 3, ["sample_a"], 5, 42);

        expect(fs.existsSync(path.join(base_folder, "storage", "3", "sample_a", "sample_a.ctd"))).toBe(true);
        expect(dataSource.updateOne).toBeCalledWith(expect.objectContaining({
            sample_id: 7,
            ctd_imported: true,
            ctd_importator_user_id: 5,
            ctd_import_task_id: 42,
            ctd_description: "01=pH",
            ctd_latitude: null,
            ctd_longitude: null,
        }));
    });

    test("import stores the CTD file start position", async () => {
        await repo.importCTDSamples("project_src", "UVP6HF", 3, ["sample_b"], 5, 42);

        expect(dataSource.updateOne).toBeCalledWith(expect.objectContaining({
            sample_id: 8,
            ctd_latitude: 63.3476,
            ctd_longitude: -20.2736,
            ctd_description: "01=LAT\n02=LON",
        }));
        expect(dataSource.updateOne.mock.calls[0][0]).not.toHaveProperty("use_ctd_coordinates");
    });

    test("delete clears every CTD import field", async () => {
        const sample: PublicSampleModel = { ...sampleModel_1, sample_id: 7, sample_name: "sample_a", project_id: 3, ctd_imported: true, ctd_file_extension: "ctd" };

        await repo.deleteImportedCTDSamplesFromDb([sample]);

        expect(dataSource.updateOne).toBeCalledWith({
            sample_id: 7,
            ctd_imported: false,
            ctd_station_id: undefined,
            ctd_file_extension: undefined,
            ctd_import_utc_date_time: undefined,
            ctd_original_file_name: undefined,
            ctd_imported_file_name: undefined,
            ctd_importator_user_id: undefined,
            ctd_latitude: undefined,
            ctd_longitude: undefined,
            ctd_import_task_id: undefined,
            ctd_description: undefined,
            use_ctd_coordinates: false,
        });
        expect(Object.keys(dataSource.updateOne.mock.calls[0][0])).toEqual(expect.arrayContaining([
            "ctd_original_file_name", "ctd_imported_file_name", "ctd_importator_user_id", "ctd_import_task_id", "ctd_description",
        ]));
    });
});
