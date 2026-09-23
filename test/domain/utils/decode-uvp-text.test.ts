import { decodeUvpText } from "../../../src/domain/utils/decode-uvp-text";

describe("decodeUvpText", () => {
    test("Should decode a Latin-1 file without replacement characters", () => {
        expect(decodeUvpText(Buffer.from("Téthys_2;Rémi", "latin1"))).toBe("Téthys_2;Rémi");
    });

    test("Should decode a UTF-8 file as UTF-8", () => {
        expect(decodeUvpText(Buffer.from("Téthys_2;Rémi", "utf8"))).toBe("Téthys_2;Rémi");
    });

    test("Should leave plain ASCII untouched", () => {
        expect(decodeUvpText(Buffer.from("cruise;ship\nomer;atalante", "utf8"))).toBe("cruise;ship\nomer;atalante");
    });
});
