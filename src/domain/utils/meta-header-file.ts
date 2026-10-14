import path from "path";

// The header legacy EcoPart reads: meta/<instrument>_header_<rest of the project folder name>.txt,
// e.g. uvp6_sn000171hf_20230720_wcb_1_test → uvp6_header_sn000171hf_20230720_wcb_1_test.txt.
export function canonicalMetaHeaderFileName(project_folder: string): string | null {
    const match = /^([^_]+)_(.+)$/.exec(path.basename(project_folder));
    return match ? `${match[1]}_header_${match[2]}.txt` : null;
}

// Only the canonical header is read: meta/ often keeps other headers next to it (another
// deployment, copies), and nothing tells which of them is right.
export function selectMetaHeaderFile(file_names: string[], project_folder: string): string {
    const canonical = canonicalMetaHeaderFileName(project_folder);
    if (canonical === null) {
        throw new Error(`Meta header file not found: the project folder ${path.basename(project_folder)} is not named <instrument>_<name>`);
    }
    if (!file_names.includes(canonical)) {
        throw new Error(`Meta header file not found: meta/${canonical}`);
    }
    return canonical;
}
