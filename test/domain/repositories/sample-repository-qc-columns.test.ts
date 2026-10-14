import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";
import { PerImageColumnsBuilder, toPerImageColumns } from "../../../src/domain/utils/per-image-columns";

// The parsers are pure (no IO), so a dummy datasource is fine.
const repo = new SampleRepositoryImpl({} as any, "") as any;

// The QC graphs read particules.csv with a lean parser; it must give what the full parser gives,
// once kept to the columns (1 to 3 pixel classes).
const LINES = [
    "HW_CONF,000213LP,0,UNDEFINED,0,000226VE2",
    "ACQ_CONF,ACQ_SUP_01,2,2.000",
    "",
    "20240612-003906-1,3.13,15,1:1,5117,29.3,10.5;2,498,36.5,16.9;3,101,43.4,24.0;4,38,49.0,27.1",
    "20240612-003907-1,3.20,15,0:1,7,29.3,10.5;2,3,36.5,16.9",
    "20240612-003908-1,NaN,15,1:2,40,30.0,1.0;3,6,31.0,2.0",
    "20240612-003909-1,4.5,15,1:1",
    "20240612-003910-1,4.5,15,1:1,",
    "20240612-003911-1,4.5,15,1:1,;2,9",
    "20240612-003912-1,4.5,15,1:4,12,30.0,1.0;1,3,31.0,2.0;5,8,0,0",
    "20240612-003913-1,4.5,15,1:1,5,30,1;1,7,30,1;2,1,30,1;2,2,30,1",
    "20240612-003914-1,4.5,15,1:OVER_EXPOSED",
    "20240612-003915-1,4.5,15,1:EMPTY_IMAGE",
    "20240612-003916-1,4.5,15, 1:3 ,22,30,1; 2 , 4 ,30,1",
    "20240612-003917-1,4.5,15,1,22,30,1;2,4,30,1",
    "20240612-003918-1,4.5,15,:3,22,30,1",
    "20240612-003919-1,4.5,15,1:2:7,22,30,1",
    "20240612-003920-1,4.5,15,1:1,-3,30,1;2,1e3,30,1;3,x,30,1;",
    "20240612-003921-1,4.5,15,1:1,5,30,1;;3",
    "20240612-003922-1,4.5",
    "2024061,4.5,15,1:1,5",
    "  20240612-003923-1,4.5,15,1:1,5",
    "20240612-003924-1 ,4.5,15,0:1,5,30,1;2,6,30,1;3,7,30,1",
    "20240612-xyz,4.5,15,1:1,5,30,1",
    "20240612-003925-1,4.5,15,1:1,\t5,30,1;\t2,6,30,1;+3,+7,30,1;02,08,30,1",
    "20240612-003926-1,4.5,15,1:3,\u00a09,30,1;2,\u00a04,30,1;1, ,30,1;3,12345678901234567890,30,1",
    "20240612-003927-1,4.5,15,1:+2,9,30,1;-1,4,30,1;3,-6,30,1;2,7",
];

describe("particules.csv row of the QC graphs", () => {
    test("gives what the full parser gives, kept to the columns", () => {
        const lean = new PerImageColumnsBuilder();
        let image_index = 0;
        for (const line of LINES) {
            if (repo.pushParticulesCsvQcRow(lean, line, image_index)) image_index++;
        }

        const full = repo.parsePivotParticulesCsv(LINES.join("\n"));

        expect(lean.build()).toEqual(toPerImageColumns(full));
        expect(full.length).toBe(21);
    });
});
