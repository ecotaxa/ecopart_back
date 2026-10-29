import { formatBytes } from "../../../../src/domain/use-cases/export/export-log";

describe("formatBytes", () => {
    test.each([
        [0, "0 B"],
        [999, "999 B"],
        [1000, "1.0 kB"],
        [12_345_678, "12.3 MB"],
        [2_500_000_000, "2.5 GB"],
    ])("%d bytes read %s", (bytes, label) => {
        expect(formatBytes(bytes)).toBe(label);
    });
});
