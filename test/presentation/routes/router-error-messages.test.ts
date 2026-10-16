import fs from "fs";
import path from "path";

// Routers choose the HTTP status by comparing err.message with a literal. When the use case throws a
// slightly different text ("delet", "exist" for "exists"...), the branch never matches and the client
// gets a 500. This test lists every message a router compares with === and checks something throws it.

const SRC = path.resolve(__dirname, "../../../src");

// Compared by a router but thrown nowhere today: dead branches, harmless, kept out of this change.
// Do not add to this list to make the test pass: fix the message on one side instead.
const KNOWN_UNREACHABLE = new Set([
    "Cannot create ecotaxa account",
    "Cannot create privileges for project",
    "Cannot find deleted user",
    "Cannot find task file",
    "Contact user cannot be use",
    "Ecotaxa instance id should be a number",
    "HTTP Error: 403",
    "Logged user cannot delete this ecotaxa account",
    "Logged user cannot login to this ecotaxa account",
    "Manager user cannot be use",
    "Member user cannot be use",
    "User email is not validated",
]);

function listTsFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listTsFiles(full);
        return entry.name.endsWith(".ts") ? [full] : [];
    });
}

describe("Router error messages", () => {
    const files = listTsFiles(SRC);
    const routerFiles = files.filter((f) => f.includes(`${path.sep}routers${path.sep}`));

    const thrown = new Set<string>();
    for (const file of files.filter((f) => !routerFiles.includes(f))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(/new Error\(\s*"([^"]+)"/g)) thrown.add(match[1]);
        for (const match of source.matchAll(/new Error\(\s*'([^']+)'/g)) thrown.add(match[1]);
        for (const match of source.matchAll(/const \w+_MESSAGE\s*=\s*"([^"]+)"/g)) thrown.add(match[1]);
    }

    const compared = new Map<string, string[]>();
    for (const file of routerFiles) {
        fs.readFileSync(file, "utf8").split("\n").forEach((line, index) => {
            for (const match of line.matchAll(/err\.message\s*===\s*"([^"]+)"/g)) {
                compared.set(match[1], [...(compared.get(match[1]) ?? []), `${path.basename(file)}:${index + 1}`]);
            }
        });
    }

    test("finds the router comparisons", () => {
        expect(compared.size).toBeGreaterThan(50);
    });

    test("every message a router compares is thrown somewhere", () => {
        const unmatched = [...compared.entries()]
            .filter(([message]) => !thrown.has(message) && !KNOWN_UNREACHABLE.has(message))
            .map(([message, where]) => `${message} (${where.join(", ")})`);
        expect(unmatched).toEqual([]);
    });

    test("the known unreachable list holds no message that became reachable", () => {
        expect([...KNOWN_UNREACHABLE].filter((message) => thrown.has(message))).toEqual([]);
    });
});
