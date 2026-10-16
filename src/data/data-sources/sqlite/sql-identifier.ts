const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

// Object keys are concatenated into the generated SQL as column names, so only plain
// identifiers may go through: anything else would let a caller inject SQL fragments.
export function sqlIdentifier(name: string): string {
    if (!SQL_IDENTIFIER.test(name)) throw new Error("Invalid column name")
    return name
}
