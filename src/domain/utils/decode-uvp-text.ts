const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

// Decode a text file coming from a UVP project folder (meta headers, cruise_info.txt,
// work/ files...). The acquisition software writes them in Latin-1, which legacy EcoPart
// always read as latin_1, but some files are re-saved as UTF-8 along the way. Strict UTF-8
// first, Latin-1 fallback: a Latin-1 "é" (0xE9) is invalid UTF-8, and reading it as utf8
// silently turns "Téthys" into "T�thys".
export function decodeUvpText(buffer: Buffer): string {
    try {
        return strictUtf8.decode(buffer);
    } catch {
        return buffer.toString("latin1");
    }
}
