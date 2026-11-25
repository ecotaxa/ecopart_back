// Latitude and longitude as written in the UVP sample headers.
//
// UVP5 headers keep the historical "degrees.minutes" notation: 43.4111 reads 43°41.11', that is
// 43.68517 decimal degrees, as legacy EcoPart converted it. UVP6 headers are in decimal degrees.
// Both may also be written "DD°MM SS".
export type UvpCoordinateNotation = "degrees.minutes" | "decimal degrees";

const DEGREES_MINUTES_SECONDS = /(-?\d+)°(\d+) (\d+)/;

const round5 = (value: number) => parseFloat(value.toFixed(5));

// In degrees.minutes the decimal part holds the minutes: 0.60 or more is not a position.
export function minutesPartIsValid(value: number): boolean {
    return Math.abs(round5(value - Math.trunc(value))) < 0.6;
}

// Why a value of a UVP5 header cannot be read as degrees.minutes, or null when it can. Such a value
// was typed in another unit or mistyped, nobody can tell which: the sample is refused at import
// rather than placed at a guessed position.
export function degreesMinutesProblem(field: "latitude" | "longitude", text: string | undefined): string | null {
    if (text === undefined || DEGREES_MINUTES_SECONDS.test(text)) return null;
    const value = parseFloat(text);
    if (Number.isNaN(value) || minutesPartIsValid(value)) return null;
    return `${field} ${text.trim()} is not in degrees.minutes (the decimal part holds the minutes and must be below 0.60)`;
}

export function parseUvpCoordinate(text: string, notation: UvpCoordinateNotation): number {
    const dms = DEGREES_MINUTES_SECONDS.exec(text);
    if (dms) {
        const degrees = parseFloat(dms[1]);
        const minutes = parseFloat(dms[2]) + parseFloat(dms[3]) / 60;
        // The sign of the text, not of the number: "-0°30 00" is south of the equator
        const sign = dms[1].startsWith("-") ? -1 : 1;
        return round5(degrees + sign * (minutes / 60));
    }

    const value = parseFloat(text);
    if (notation === "decimal degrees") return round5(value);
    if (!minutesPartIsValid(value)) {
        throw new Error(`Position ${text.trim()} is not in degrees.minutes: the decimal part holds the minutes and must be below 0.60`);
    }
    // Truncated toward zero so that the minutes keep the sign of the degrees (-21.5997 is 21°59.97' south)
    const degrees = Math.trunc(value);
    return round5(degrees + (value - degrees) / 0.6);
}
