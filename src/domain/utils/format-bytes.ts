const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB"];

// A byte count as the task log shows it ("12.3 MB"), in powers of 1000.
export function formatBytes(bytes: number): string {
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
        value /= 1000;
        unit += 1;
    }
    return unit === 0 ? `${value} ${BYTE_UNITS[0]}` : `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}
