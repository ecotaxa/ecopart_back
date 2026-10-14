import fs from "fs";
import os from "os";
import path from "path";

import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";

describe("explainNotImportableSamples", () => {
    let tmp: string;
    let dest_folder: string;
    let repo: SampleRepositoryImpl;
    const getAll = jest.fn();

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-importable-"));
        fs.mkdirSync(path.join(tmp, "uvp5_m197", "meta"), { recursive: true });
        fs.writeFileSync(path.join(tmp, "uvp5_m197", "meta", "uvp5_header_m197.txt"), [
            "cruise;ship;filename;profileid",
            "m197;ship;file_a;in_db",
            "m197;ship;file_b;in_storage",
            "m197;ship;file_c;listed",
        ].join("\n"));
        dest_folder = path.join(tmp, "storage", "1");
        fs.mkdirSync(path.join(dest_folder, "in_storage"), { recursive: true });

        getAll.mockReset().mockResolvedValue({ items: [{ sample_name: "in_db" }], total: 1 });
        repo = new SampleRepositoryImpl({ getAll } as any, "");
        repo.base_folder = tmp;
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    test("gives one reason per sample left out of the importable list", async () => {
        const reasons = await repo.explainNotImportableSamples("uvp5_m197", dest_folder, 1, ["in_db", "in_storage", "not_in_header", "listed"]);

        expect(reasons).toEqual(new Map([
            ["in_db", "already imported in this project"],
            ["in_storage", "a folder with this name already exists in the project storage but the sample is not in the database"],
            ["not_in_header", "not listed in the meta header file"],
            ["listed", "unknown reason"],
        ]));
        expect(getAll).toBeCalledWith(expect.objectContaining({ filter: [{ field: "project_id", operator: "=", value: 1 }] }));
    });
});
