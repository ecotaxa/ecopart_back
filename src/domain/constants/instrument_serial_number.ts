// Serial numbers follow a different convention per instrument family (UVP convention):
//   UVP5 → `sn` prefix + digits, model letters kept when the unit has them: `sn205`, `sn002zd`
//   UVP6 → no prefix, digits + model suffix:                                `000241LP`, `000158HF`
// Sources spell them inconsistently — the meta header file name always carries the `sn` prefix
// (`uvp5_header_sn002zd_omer_2.txt`, `uvp6_header_sn000241lp_...txt`) while `cruise_info.txt`
// (`sn=000241LP`) and `metadata.ini` (`Camera_ref=000213LP`) never do — so every read goes
// through normalizeInstrumentSerialNumber and project and sample end up with the same string.
export const INSTRUMENT_SERIAL_NUMBER_PREFIX = "sn";

export type InstrumentFamily = "UVP5" | "UVP6";

// Matches the serial number inside a meta header file name. Stops at `_` and `.` so neither
// the rest of the name nor the extension is captured, but the model letters (zd/hd/sd,
// lp/hf/mhf/mhp) are kept — they are part of the serial number and drive the instrument model.
export const INSTRUMENT_SERIAL_NUMBER_IN_FILE_NAME_REGEX = /sn([^_.]+)/i;

// Applies the family convention: `sn` prefix for UVP5, none for UVP6. An unknown family
// leaves the value untouched (nothing better to do than keep what the source said).
export function normalizeInstrumentSerialNumber(rawSerialNumber: string | null | undefined, instrumentFamily: InstrumentFamily | null): string {
    const serialNumber = (rawSerialNumber ?? "").trim();
    if (serialNumber.length === 0) return "";
    if (instrumentFamily === null) return serialNumber;

    const hasPrefix = serialNumber.toLowerCase().startsWith(INSTRUMENT_SERIAL_NUMBER_PREFIX);
    const bareSerialNumber = hasPrefix ? serialNumber.substring(INSTRUMENT_SERIAL_NUMBER_PREFIX.length) : serialNumber;

    return instrumentFamily === "UVP5" ? INSTRUMENT_SERIAL_NUMBER_PREFIX + bareSerialNumber : bareSerialNumber;
}

// Returns the serial number as written in the file name, `sn` prefix included.
// Callers pass it through normalizeInstrumentSerialNumber to apply the family convention.
export function extractInstrumentSerialNumberFromFileName(fileName: string): string | null {
    const match = fileName.match(INSTRUMENT_SERIAL_NUMBER_IN_FILE_NAME_REGEX);
    return match ? match[1] : null;
}

// "UVP5HD" / "UVP6LP" → "UVP5" / "UVP6". Null for anything else.
export function instrumentFamilyFromModelName(instrumentModelName: string | null | undefined): InstrumentFamily | null {
    const modelName = (instrumentModelName ?? "").trim().toUpperCase();
    if (modelName.startsWith("UVP5")) return "UVP5";
    if (modelName.startsWith("UVP6")) return "UVP6";
    return null;
}
