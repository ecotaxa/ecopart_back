import { degreesMinutesProblem, parseUvpCoordinate } from "../../../src/domain/utils/uvp-coordinates";

describe("parseUvpCoordinate", () => {
    // Values checked against legacy EcoPart on preprod samples (new stored value -> legacy value)
    test.each([
        ["43.4111", 43.68517],
        ["7.1901", 7.31683],
        ["43.2332", 43.38867],
        ["7.3618", 7.603],
        ["-21.5997", -21.9995],
        ["-72.0001", -72.00017],
        ["-0.3995", -0.66583],
        ["-18.0", -18],
        ["158.1692", 158.282],
    ])("degrees.minutes %s : ok, %d decimal degrees", (text, expected) => {
        expect(parseUvpCoordinate(text, "degrees.minutes")).toBe(expected);
    });

    test.each(["32.9", "-149.7199", "7.6", "27.7972"])("degrees.minutes %s with a decimal part that cannot be minutes : ko", (text) => {
        expect(() => parseUvpCoordinate(text, "degrees.minutes")).toThrow(`Position ${text} is not in degrees.minutes: the decimal part holds the minutes and must be below 0.60`);
    });

    test("a decimal part just under 0.60 is converted : ok", () => {
        expect(parseUvpCoordinate("7.5999", "degrees.minutes")).toBe(7.99983);
    });

    test.each([
        ["43.67861", 43.67861],
        ["7.94152", 7.94152],
        ["-62.091944", -62.09194],
    ])("decimal degrees %s : ok, only rounded to 5 decimals", (text, expected) => {
        expect(parseUvpCoordinate(text, "decimal degrees")).toBe(expected);
    });

    test.each([
        ["43°41 06", 43.685],
        ["-21°30 00", -21.5],
        ["-0°30 00", -0.5],
    ])("degrees, minutes and seconds %s : ok, whatever the notation", (text, expected) => {
        expect(parseUvpCoordinate(text, "degrees.minutes")).toBe(expected);
        expect(parseUvpCoordinate(text, "decimal degrees")).toBe(expected);
    });
});

describe("degreesMinutesProblem", () => {
    test.each(["43.4111", "-21.5997", "7.5999", "-18.0", "43°41 06", "", undefined])("%s can be degrees.minutes (or is not a number to judge) : ok, no problem", (text) => {
        expect(degreesMinutesProblem("latitude", text)).toBeNull();
    });

    test.each([
        ["latitude", "32.9"],
        ["longitude", "-64.6"],
        ["longitude", " -149.7199 "],
    ] as const)("%s %s has a decimal part of 0.60 or more : ko, the problem names the value", (field, text) => {
        expect(degreesMinutesProblem(field, text)).toBe(`${field} ${text.trim()} is not in degrees.minutes (the decimal part holds the minutes and must be below 0.60)`);
    });
});
