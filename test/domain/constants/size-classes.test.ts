import { PART_DET_CLASS_LIMITS_MM, SIZE_CLASS_COUNT, sizeClassOfEsd, sizeClassSuffix } from "../../../src/domain/constants/size-classes";

describe("size classes", () => {
    test("the legacy grid has 46 bounds, hence 45 classes", () => {
        expect(PART_DET_CLASS_LIMITS_MM).toHaveLength(46);
        expect(SIZE_CLASS_COUNT).toBe(45);
    });

    test("an ESD falls in the class whose lower bound it reaches, upper bound excluded", () => {
        expect(sizeClassOfEsd(0.0508)).toBe(17);           // [50.8 µm, 64 µm)
        expect(sizeClassOfEsd(0.0639)).toBe(17);
        expect(sizeClassOfEsd(0.064)).toBe(18);
        expect(sizeClassOfEsd(0.0541)).toBe(17);           // 1 px of a UVP6 with Aa 2300, Exp 1.136
        expect(sizeClassOfEsd(0.001)).toBe(0);
    });

    test("the last class is open and nothing below 1 µm has a class", () => {
        expect(sizeClassOfEsd(26)).toBe(44);
        expect(sizeClassOfEsd(500)).toBe(44);
        expect(sizeClassOfEsd(0.0009)).toBe(-1);
        expect(sizeClassOfEsd(NaN)).toBe(-1);
    });

    test("column suffixes give both bounds in µm, `p` for the decimal point, `inf` for the open bound", () => {
        expect(sizeClassSuffix(0)).toBe("1um_1p26um");
        expect(sizeClassSuffix(1)).toBe("1p26um_1p59um");
        expect(sizeClassSuffix(17)).toBe("50p8um_64um");
        expect(sizeClassSuffix(19)).toBe("80p6um_102um");
        expect(sizeClassSuffix(43)).toBe("20600um_26000um");
        expect(sizeClassSuffix(44)).toBe("26000um_inf");
    });
});
