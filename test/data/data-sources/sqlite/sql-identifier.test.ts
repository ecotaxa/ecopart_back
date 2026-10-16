import { sqlIdentifier } from "../../../../src/data/data-sources/sqlite/sql-identifier";

describe("sqlIdentifier", () => {
    test.each(["project_id", "task_status_id", "_private", "Col1"])("accepts the plain column name %s", (name) => {
        expect(sqlIdentifier(name)).toBe(name);
    });

    test.each([
        "project_id = 1 OR project.project_id",
        "task.task_id",
        "user_id;--",
        "1project",
        "",
        "email) OR (1=1",
    ])("rejects %p", (name) => {
        expect(() => sqlIdentifier(name)).toThrow("Invalid column name");
    });
});
