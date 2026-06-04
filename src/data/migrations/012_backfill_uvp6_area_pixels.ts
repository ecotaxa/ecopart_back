import { Migration } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Backfill placeholder for UVP6 area-pixels columns.
//
// The values come from the ACQ_CONF line of each sample's LPM data.txt file, converted via
// area_px = floor((π × (ESD_mm/2)²) / Aa)^(1/Exp). The exact positions inside ACQ_CONF need
// to be confirmed with Marc (see plan, follow-up #10). Until those positions are locked, this
// migration is a no-op so we don't corrupt existing rows with placeholder values.
//
// When the positions are known, fill in `backfillForSample` and switch the up() body to
// iterate samples grouped by UVP6 projects.

export const migration: Migration = {
    id: "012_backfill_uvp6_area_pixels",

    async up(_db: SQLiteDatabaseWrapper): Promise<void> {
        // TODO(marc): once ACQ_CONF positions are confirmed, iterate UVP6 samples and write
        // instrument_settings_particule_minimum_area_pixels / vignette_minimum_area_pixels
        // from data.txt under DATA_STORAGE_FS_STORAGE/{project_id}/{sample_name}/.
    },

    async down(_db: SQLiteDatabaseWrapper): Promise<void> {
        // No-op (the backfill is best-effort and idempotent).
    },
};
