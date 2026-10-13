import path from "path";
import { isInsideFolder } from "../../../src/domain/utils/path-containment";

describe("isInsideFolder", () => {
    const root = path.join("data_storage", "ecopart_data_to_import");

    test.each([
        root,
        path.join(root, "uvp5_sn010_2014"),
        path.join(root, "remote", "piqv", "plankton", "uvp6"),
        path.join(root, "a", "..", "b"),
    ])("accepts %s", (target) => {
        expect(isInsideFolder(root, target)).toBe(true);
    });

    test.each([
        path.join(root, ".."),
        path.join(root, "..", "sqlite_db"),
        root + "_old",
        path.join(root + "_old", "x"),
        "/etc/passwd",
    ])("rejects %s", (target) => {
        expect(isInsideFolder(root, target)).toBe(false);
    });
});
