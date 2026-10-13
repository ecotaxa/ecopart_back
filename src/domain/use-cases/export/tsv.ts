// TSV conventions shared by the export products: UTF-8, tab-separated, one header row, no quoting.

// Replace tab/CR/LF in a TSV cell with a single space so the row stays parseable; no quoting.
export function tsvSanitize(value: string): string {
    return value.replace(/[\t\r\n]+/g, " ");
}

export function serialize(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "true" : "false";
    return tsvSanitize(String(value));
}

export function toIso(date_string: string): string {
    const d = new Date(date_string);
    return Number.isNaN(d.getTime()) ? date_string : d.toISOString();
}

export function toTsv(headers: string[], rows: Record<string, string>[]): string {
    if (headers.length === 0) return "";
    const lines = [headers.join("\t")];
    for (const row of rows) {
        lines.push(headers.map(h => row[h] ?? "").join("\t"));
    }
    return lines.join("\n") + "\n";
}
