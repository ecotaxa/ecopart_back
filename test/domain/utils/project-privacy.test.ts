import { computeProjectPrivacy } from "../../../src/domain/utils/project-privacy";

describe("computeProjectPrivacy", () => {
    const now = new Date(Date.UTC(2026, 9, 12));

    test.each([
        ["2026-10-01T00:00:00Z", "private"],
        ["2026-08-01T00:00:00Z", "visible"],
        ["2026-06-01T00:00:00Z", "public"],
        ["2024-04-29 15:43:10", "open"],
    ])("a project created on %s is %s with delays of 2 months each", (created, level) => {
        expect(computeProjectPrivacy(created, 2, 2, 2, now)).toBe(level);
    });

    test("an unreadable creation date keeps the project private rather than opening it", () => {
        expect(computeProjectPrivacy("not a date", 0, 0, 0, now)).toBe("private");
    });
});
