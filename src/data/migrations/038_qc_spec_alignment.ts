import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Quality checks of the project STATS tab aligned on the specification: two project options (the data
// of a UVP5HD project were filtered before import; the time duration check may be disabled on a
// project longer than a year) and the minimum pressure of each sample, computed from its pivot with
// the particle statistics (NULL until computed: task COMPUTE_PARTICLE_STATS fills it).
export const migration: Migration = {
    id: "038_qc_spec_alignment",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const columnsOf = async (table: string) => {
            const rows = await new Promise<{ name: string }[]>((resolve, reject) =>
                db.all(`PRAGMA table_info(${table});`, [], (err, rows) => err ? reject(err) : resolve(rows as { name: string }[])));
            return new Set(rows.map(column => column.name));
        };
        const project = await columnsOf("project");
        if (!project.has("filtered_project")) await runSQL(db, "ALTER TABLE project ADD COLUMN filtered_project BOOLEAN NOT NULL DEFAULT 0;");
        if (!project.has("time_duration_check")) await runSQL(db, "ALTER TABLE project ADD COLUMN time_duration_check BOOLEAN NOT NULL DEFAULT 1;");
        const sample = await columnsOf("sample");
        if (!sample.has("min_pressure")) await runSQL(db, "ALTER TABLE sample ADD COLUMN min_pressure REAL;");
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "ALTER TABLE sample DROP COLUMN min_pressure;");
        await runSQL(db, "ALTER TABLE project DROP COLUMN time_duration_check;");
        await runSQL(db, "ALTER TABLE project DROP COLUMN filtered_project;");
    },
};
