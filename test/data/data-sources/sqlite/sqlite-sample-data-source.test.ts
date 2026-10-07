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

    describe('createMany transaction', () => {
        const named = (sample_name: string) => ({ ...sampleRequestCreationModel_1, sample_name })
        const countByName = async (names: string[]): Promise<number> => new Promise((resolve, reject) =>
            db.get(`SELECT COUNT(*) AS n FROM sample WHERE sample_name IN (${names.map(() => '?').join(',')})`, names,
                (e, row: any) => e ? reject(e) : resolve(row.n)))

        test('concurrent calls are queued instead of failing to begin a nested transaction', async () => {
            const [ids_a, ids_b] = await Promise.all([
                dataSource.createMany([named('concurrent_a1'), named('concurrent_a2')]),
                dataSource.createMany([named('concurrent_b1')]),
            ])

            expect(ids_a).toHaveLength(2)
            expect(ids_b).toHaveLength(1)
            expect(await countByName(['concurrent_a1', 'concurrent_a2', 'concurrent_b1'])).toBe(3)
        })

        test('a failing insert rolls the whole batch back and leaves no open transaction', async () => {
            const invalid = { ...named('rolled_back_2'), sample_name: null } as any

            await expect(dataSource.createMany([named('rolled_back_1'), invalid])).rejects.toThrow('Transaction rolled back due to error')

            expect(await countByName(['rolled_back_1'])).toBe(0)
            await expect(dataSource.createMany([named('after_rollback')])).resolves.toHaveLength(1)
        })

        test('a failing COMMIT is rolled back so the next call can begin a transaction', async () => {
            let fail_next_commit = true
            const flakyDb = {
                run(sql: string, params: any, callback?: any) {
                    if (sql === 'COMMIT' && fail_next_commit) {
                        fail_next_commit = false
                        const cb = typeof params === 'function' ? params : callback
                        cb.call({}, new Error('SQLITE_BUSY: database is locked'))
                        return this
                    }
                    db.run(sql, params, callback)
                    return this
                },
                get: db.get.bind(db),
                all: db.all.bind(db),
            }
            const flakyDataSource = new SQLiteSampleDataSource(flakyDb)

            await expect(flakyDataSource.createMany([named('commit_failed')])).rejects.toThrow('Failed to commit transaction')

            expect(await countByName(['commit_failed'])).toBe(0)
            await expect(flakyDataSource.createMany([named('after_commit_failure')])).resolves.toHaveLength(1)
        })
    })
})
