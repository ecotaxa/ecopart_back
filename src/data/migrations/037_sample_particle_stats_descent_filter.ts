import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// The particle statistics of each sample over the images the descent filter keeps too, next to the ones
// over the images of the operator window: the project's enable_descent_filter picks one pair when they
// are read, so changing it never leaves stale values. The values stored before were computed with the
// setting of that time, which cannot be told afterwards: they are reset, and the task
// COMPUTE_PARTICLE_STATS computes both pairs again.
export const migration: Migration = {
    id: "037_sample_particle_stats_descent_filter",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const columns = await new Promise<{ name: string }[]>((resolve, reject) =>
            db.all("PRAGMA table_info(sample);", [], (err, rows) => err ? reject(err) : resolve(rows as { name: string }[])));
        const names = new Set(columns.map(column => column.name));
        if (!names.has("nb_particles_descent_filter")) await runSQL(db, "ALTER TABLE sample ADD COLUMN nb_particles_descent_filter INTEGER;");
        if (!names.has("particle_min_area_px_descent_filter")) await runSQL(db, "ALTER TABLE sample ADD COLUMN particle_min_area_px_descent_filter INTEGER;");
        if (!names.has("particle_max_area_px_descent_filter")) await runSQL(db, "ALTER TABLE sample ADD COLUMN particle_max_area_px_descent_filter INTEGER;");
        await runSQL(db, "UPDATE sample SET nb_particles = NULL, particle_min_area_px = NULL, particle_max_area_px = NULL WHERE nb_particles_descent_filter IS NULL;");
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "ALTER TABLE sample DROP COLUMN particle_max_area_px_descent_filter;");
        await runSQL(db, "ALTER TABLE sample DROP COLUMN particle_min_area_px_descent_filter;");
        await runSQL(db, "ALTER TABLE sample DROP COLUMN nb_particles_descent_filter;");
    },
};
