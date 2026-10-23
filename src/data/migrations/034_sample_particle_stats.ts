import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Particle counts and extreme areas of each sample, computed from its pivot at import so that the
// Explore page can sum particles and give a size range without reading every particle file. NULL
// until computed (samples imported before this migration: task COMPUTE_PARTICLE_STATS).
export const migration: Migration = {
    id: "034_sample_particle_stats",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const columns = await new Promise<{ name: string }[]>((resolve, reject) =>
            db.all("PRAGMA table_info(sample);", [], (err, rows) => err ? reject(err) : resolve(rows as { name: string }[])));
        const names = new Set(columns.map(column => column.name));
        if (!names.has("nb_particles")) await runSQL(db, "ALTER TABLE sample ADD COLUMN nb_particles INTEGER;");
        if (!names.has("particle_min_area_px")) await runSQL(db, "ALTER TABLE sample ADD COLUMN particle_min_area_px INTEGER;");
        if (!names.has("particle_max_area_px")) await runSQL(db, "ALTER TABLE sample ADD COLUMN particle_max_area_px INTEGER;");
        await runSQL(db, "INSERT OR IGNORE INTO task_type (task_type_label) VALUES (?);", ["COMPUTE_PARTICLE_STATS"]);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "ALTER TABLE sample DROP COLUMN particle_max_area_px;");
        await runSQL(db, "ALTER TABLE sample DROP COLUMN particle_min_area_px;");
        await runSQL(db, "ALTER TABLE sample DROP COLUMN nb_particles;");
        await runSQL(db, "DELETE FROM task_type WHERE task_type_label = ?;", ["COMPUTE_PARTICLE_STATS"]);
    },
};
