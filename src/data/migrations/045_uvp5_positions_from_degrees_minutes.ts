import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// UVP5 sample headers give latitude and longitude in "degrees.minutes" (43.4111 = 43°41.11'), which
// legacy EcoPart converted to decimal degrees. The import stored them as written, so every UVP5
// sample sat 20 to 75 km away from its position. The import now converts them (parseUvpCoordinate);
// the positions already stored are converted here with the same rule:
//   degrees + decimal part / 0.6, the decimal part keeping the sign of the degrees.
// A sample with a latitude or a longitude whose decimal part is 0.60 or more is left untouched: that
// value cannot hold minutes, the import now refuses it, and those samples are to be deleted with the
// deletion tasks (database row, storage folder, EcoTaxa objects) BEFORE this migration runs, while
// they can still be told apart: once the others are converted, a decimal part of 0.60 or more means nothing.
// CTD positions are not concerned: they come from the CTD file, in decimal degrees.
//
// NOT idempotent by nature (a converted value looks like any other): it relies on the _migrations
// record to run once. `down` applies the reverse formula, exact to the 5 decimals kept.
const UVP5_SAMPLES = `project_id IN (
    SELECT project.project_id FROM project
    JOIN instrument_model ON instrument_model.instrument_model_id = project.instrument_model
    WHERE instrument_model.instrument_model_name LIKE 'UVP5%')`;

const decimalPart = (column: string) => `(${column} - CAST(${column} AS INTEGER))`;
const toDecimalDegrees = (column: string) => `ROUND(CAST(${column} AS INTEGER) + ${decimalPart(column)} / 0.6, 5)`;
const toDegreesMinutes = (column: string) => `ROUND(CAST(${column} AS INTEGER) + ${decimalPart(column)} * 0.6, 5)`;

const minutesPartIsValid = (column: string) => `ABS(ROUND(${decimalPart(column)}, 5)) < 0.6`;
const READABLE_POSITION = `latitude IS NOT NULL AND longitude IS NOT NULL AND ${minutesPartIsValid("latitude")} AND ${minutesPartIsValid("longitude")}`;

export const migration: Migration = {
    id: "045_uvp5_positions_from_degrees_minutes",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        // One statement: both columns are tested as stored, before either is converted
        await runSQL(db, `UPDATE sample SET latitude = ${toDecimalDegrees("latitude")}, longitude = ${toDecimalDegrees("longitude")}
            WHERE ${UVP5_SAMPLES} AND ${READABLE_POSITION};`);
    },

    // A sample left untouched by `up` had a decimal part of 0.60 or more and still has; a converted one
    // may also have (43°41.11' is 43.68517). The two cannot be told apart, so every sample is reversed:
    // only the few left untouched come back different from what they were.
    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `UPDATE sample SET latitude = ${toDegreesMinutes("latitude")}, longitude = ${toDegreesMinutes("longitude")}
            WHERE ${UVP5_SAMPLES} AND latitude IS NOT NULL AND longitude IS NOT NULL;`);
    },
};
