import {
    DETAILED_CLASSES_PER_REDUCED,
    detailedClassesOf,
    PART_DET_CLASS_LIMITS_MM,
    PART_RED_CLASS_LIMITS_MM,
    REDUCED_CLASS_COUNT,
    SIZE_CLASS_COUNT,
    sizeClassLabel,
    sizeClassOfEsd,
    sizeClassSuffix,
} from "../../../src/domain/constants/size-classes";

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

describe("reduced size classes", () => {
    test("the legacy reduced grid has 16 bounds, hence 15 classes of three detailed classes each", () => {
        expect(PART_RED_CLASS_LIMITS_MM).toHaveLength(16);
        expect(REDUCED_CLASS_COUNT).toBe(15);
        expect(DETAILED_CLASSES_PER_REDUCED).toBe(3);
    });

    test("every third detailed bound is a reduced bound, the open upper bound included", () => {
        PART_RED_CLASS_LIMITS_MM.forEach((bound, k) => expect(bound).toBe(PART_DET_CLASS_LIMITS_MM[k * DETAILED_CLASSES_PER_REDUCED]));
    });

    test("a reduced class is made of three consecutive detailed classes", () => {
        expect(detailedClassesOf(0)).toEqual([0, 1, 2]);
        expect(detailedClassesOf(6)).toEqual([18, 19, 20]);
        expect(detailedClassesOf(REDUCED_CLASS_COUNT - 1)).toEqual([42, 43, 44]);
        const all = Array.from({ length: REDUCED_CLASS_COUNT }, (_, k) => detailedClassesOf(k)).flat();
        expect(all).toEqual(Array.from({ length: SIZE_CLASS_COUNT }, (_, d) => d));
    });

    test("labels follow legacy GetClassLimitTxt: µm below 1 mm, mm above, '>' for the open class", () => {
        expect(sizeClassLabel(PART_RED_CLASS_LIMITS_MM, 0)).toBe("1-2 µm");
        expect(sizeClassLabel(PART_RED_CLASS_LIMITS_MM, 6)).toBe("64-128 µm");
        expect(sizeClassLabel(PART_RED_CLASS_LIMITS_MM, 8)).toBe("256-512 µm");
        expect(sizeClassLabel(PART_RED_CLASS_LIMITS_MM, 9)).toBe("0.512-1.02 mm");
        expect(sizeClassLabel(PART_RED_CLASS_LIMITS_MM, 10)).toBe("1.02-2.05 mm");
        expect(sizeClassLabel(PART_RED_CLASS_LIMITS_MM, 13)).toBe("8.19-16.4 mm");
        expect(sizeClassLabel(PART_RED_CLASS_LIMITS_MM, 14)).toBe(">16.4 mm");
    });

    test("the same labels serve the detailed classes", () => {
        expect(sizeClassLabel(PART_DET_CLASS_LIMITS_MM, 0)).toBe("1-1.26 µm");
        expect(sizeClassLabel(PART_DET_CLASS_LIMITS_MM, 17)).toBe("50.8-64 µm");
        expect(sizeClassLabel(PART_DET_CLASS_LIMITS_MM, 43)).toBe("20.6-26 mm");
        expect(sizeClassLabel(PART_DET_CLASS_LIMITS_MM, 44)).toBe(">26 mm");
    });
});
