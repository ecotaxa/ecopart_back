import { CtdRows } from "../entities/ctd";
import { CTD_COLUMN_ALIASES } from "../constants/ctd-columns";

export const CTD_TIME_COLUMN = "time [yyyymmddhhmmssmmm]";
export const CTD_PRESSURE_COLUMN = "pressure [db]";

// A CTD column title as the import stores it: lower-cased, spaces collapsed, aliases resolved.
export function normalizeCtdColumn(title: string): string {
    const normalized = title.trim().toLowerCase().replace(/\s+/g, " ");
    return CTD_COLUMN_ALIASES[normalized] ?? normalized;
}

// "yyyymmddhhmmssmmm" (the milliseconds may be missing) to epoch milliseconds, null when unreadable.
export function parseCtdTime(value: string): number | null {
    const digits = value.trim();
    if (!/^\d{14}(\d{3})?$/.test(digits)) return null;
    const n = (from: number, to: number) => Number(digits.slice(from, to));
    const [year, month, day, hour, minute, second] = [n(0, 4), n(4, 6), n(6, 8), n(8, 10), n(10, 12), n(12, 14)];
    const ms = Date.UTC(year, month - 1, day, hour, minute, second, digits.length === 17 ? n(14, 17) : 0);
    // Date.UTC rolls an impossible field over (month 13, hour 25, 30 February): refused instead.
    const date = new Date(ms);
    const same = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
        && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
    return Number.isFinite(ms) && same ? ms : null;
}

function parseCtdValue(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed.replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

/* The rows of a CTD file (tab separated, header on the first line, as validated at import). A line
 * with fewer cells than the header is padded with nulls, extra cells are dropped. */
export async function parseCtdRows(lines: AsyncIterable<string>): Promise<CtdRows> {
    let columns: string[] | null = null;
    let time_index = -1;
    const values: (number | null)[][] = [];
    const time_ms: (number | null)[] = [];
    for await (const line of lines) {
        if (line.trim() === "") continue;
        const cells = line.split("\t");
        if (columns === null) {
            columns = cells.map(normalizeCtdColumn);
            time_index = columns.indexOf(CTD_TIME_COLUMN);
            continue;
        }
        const row: (number | null)[] = new Array(columns.length).fill(null);
        for (let i = 0; i < columns.length && i < cells.length; i++) {
            row[i] = i === time_index ? null : parseCtdValue(cells[i]);
        }
        values.push(row);
        time_ms.push(time_index >= 0 && time_index < cells.length ? parseCtdTime(cells[time_index]) : null);
    }
    return { columns: columns ?? [], values, time_ms };
}
