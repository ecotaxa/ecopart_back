import { computeProjectPrivacy, privacyMilestone, privacyMilestones } from "../../../src/domain/utils/project-privacy";

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

describe("privacyMilestone", () => {
    // The milestone is the first instant computeProjectPrivacy counts the months as elapsed.
    const just_before = (iso: string) => new Date(Date.parse(iso) - 1);

    test.each([
        ["2024-01-15T10:20:00Z", 1, "2024-02-15T00:00:00.000Z"],
        ["2024-01-15T10:20:00Z", 12, "2025-01-15T00:00:00.000Z"],
        ["2024-11-30T23:59:59Z", 3, "2025-03-01T00:00:00.000Z"],
    ])("from %s, %i month(s) later is %s", (from, months, expected) => {
        expect(privacyMilestone(from, months)).toBe(expected);
        expect(computeProjectPrivacy(from, months, 0, 0, new Date(expected))).toBe("open");
        expect(computeProjectPrivacy(from, months, 0, 0, just_before(expected))).toBe("private");
    });

    test("a day the target month does not have: reached on the 1st of the following month", () => {
        expect(privacyMilestone("2024-01-31T08:00:00Z", 1)).toBe("2024-03-01T00:00:00.000Z");
        expect(computeProjectPrivacy("2024-01-31T08:00:00Z", 1, 0, 0, new Date("2024-03-01T00:00:00Z"))).toBe("open");
        expect(computeProjectPrivacy("2024-01-31T08:00:00Z", 1, 0, 0, new Date("2024-02-29T23:59:59Z"))).toBe("private");
    });

    test("no sample date, or an unreadable one: no milestone", () => {
        expect(privacyMilestone(null, 2)).toBeNull();
        expect(privacyMilestone("not a date", 2)).toBeNull();
    });

    test("privacyMilestones chains the three delays", () => {
        expect(privacyMilestones("2024-01-15T10:20:00Z", 2, 24, 36)).toEqual({
            visible: "2024-03-15T00:00:00.000Z",
            public: "2026-03-15T00:00:00.000Z",
            open: "2029-03-15T00:00:00.000Z",
        });
        expect(privacyMilestones(null, 2, 24, 36)).toEqual({ visible: null, public: null, open: null });
    });
});
