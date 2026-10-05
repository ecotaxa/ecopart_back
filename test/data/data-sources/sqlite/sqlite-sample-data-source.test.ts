import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { MigrationManager } from '../../../../src/data/migrations/migration-manager'
import { SQLiteSampleDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-sample-data-source'
import { sampleRequestCreationModel_1 } from '../../../entities/sample'

const DBFILE = 'TEST_DB_SOURCE_SAMPLE'

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise<void>((resolve, reject) => db.run(sql, params, (e) => e ? reject(e) : resolve()))
}

describe('SQLiteSampleDataSource', () => {
    let db: sqlite3.Database
    let dataSource: SQLiteSampleDataSource
    let sample_id: number

    beforeAll(async () => {
        db = new sqlite3.Database(DBFILE)
        await new MigrationManager(db).runAllMigrations(path.resolve(__dirname, '../../../../src/data/migrations'))
        // The fixture points at a project/user that this test does not seed.
        await run(db, 'PRAGMA foreign_keys = OFF')
        dataSource = new SQLiteSampleDataSource(db)
        sample_id = await dataSource.createOne(sampleRequestCreationModel_1)
    })

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()))
        if (fs.existsSync(DBFILE)) fs.unlinkSync(DBFILE)
    })

    describe('boolean flags are mapped to booleans, not 0/1', () => {
        test('false when the columns hold 0', async () => {
            const sample = await dataSource.getOne({ sample_id })
            expect(sample?.ecotaxa_sample_imported).toBe(false)
            expect(sample?.ctd_imported).toBe(false)
            expect(sample?.use_ctd_coordinates).toBe(false)
        })

        test('true when the columns hold 1', async () => {
            await run(db, `UPDATE sample SET ecotaxa_sample_imported = 1, ctd_imported = 1, use_ctd_coordinates = 1 WHERE sample_id = ?`, [sample_id])

            const sample = await dataSource.getOne({ sample_id })
            expect(sample?.ecotaxa_sample_imported).toBe(true)
            expect(sample?.ctd_imported).toBe(true)
            expect(sample?.use_ctd_coordinates).toBe(true)

            const all = await dataSource.getAll({ filter: [], sort_by: [], page: 1, limit: 10 })
            expect(all.items[0].ecotaxa_sample_imported).toBe(true)
        })
    })
})
