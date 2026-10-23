// The rows of a sample's CTD file, as the Explore graphs read them: one column per variable, named
// as in `CTD_STANDARD_COLUMNS` when the title is a standard one (aliases resolved), as written
// otherwise; the time column, when present, also parsed to epoch milliseconds.
export interface CtdRows {
    columns: string[];
    values: (number | null)[][];              // values[row][column], null when unreadable or NaN
    time_ms: (number | null)[];               // per row, from "time [yyyymmddhhmmssmmm]"
}
