import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { MigrationManager } from '../../../../src/data/migrations/migration-manager'
import { SQLiteSampleDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-sample-data-source'
import { sampleRequestCreationModel_1 } from '../../../entities/sample'
import { ExploreSampleQuery, StoredEcoTaxaStats } from '../../../../src/domain/entities/explore'
import { SampleRequestCreationModel } from '../../../../src/domain/entities/sample'

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
    describe('Explore queries', () => {
        // Projects of their own, so that the samples created above do not get in the way.
        const P1 = 9001, P2 = 9002, P3 = 9003, NAMES = 9004
        const ids: Record<string, number> = {}
        let depth_type_id: number
        let time_type_id: number
        let validated_id: number

        const typeId = (label: string): Promise<number> => new Promise((resolve, reject) =>
            db.get('SELECT sample_type_id AS id FROM sample_type WHERE sample_type_label = ?', [label], (e, row: any) => e ? reject(e) : resolve(row.id)))

        async function create(sample_name: string, project_id: number, overrides: Partial<SampleRequestCreationModel>, columns: Record<string, unknown> = {}): Promise<void> {
            const sample_id = await dataSource.createOne({ ...sampleRequestCreationModel_1, sample_name, project_id, sample_type_id: depth_type_id, ...overrides })
            ids[sample_name] = sample_id
            const names = Object.keys(columns)
            if (names.length > 0) await run(db, `UPDATE sample SET ${names.map(name => `${name} = ?`).join(', ')} WHERE sample_id = ?`, [...Object.values(columns), sample_id])
        }

        const query = (overrides: Partial<ExploreSampleQuery> = {}): ExploreSampleQuery => ({
            sample_type_label: 'Depth', project_ids: [P1, P2, P3], bounds: null, date_from: null, date_to: null, months: [], sample_names: [],
            hour_range: null, pressure_range: null, ctd_only: false, ecotaxa_imported_only: false, ...overrides,
        })
        const names = async (overrides: Partial<ExploreSampleQuery> = {}) => (await dataSource.getExploreSamples(query(overrides))).map(sample => sample.sample_name)

        beforeAll(async () => {
            depth_type_id = await typeId('Depth')
            time_type_id = await typeId('Time')
            validated_id = await new Promise<number>((resolve, reject) =>
                db.get("SELECT visual_qc_status_id AS id FROM visual_quality_check_status WHERE visual_qc_status_label = 'VALIDATED'", [], (e, row: any) => e ? reject(e) : resolve(row.id)))

            await create('ligurian_001', P1, { latitude: 43.4, longitude: 7.87, sampling_utc_date_time: '2024-06-12T10:20:00Z', max_pressure: 500 },
                { visual_qc_status_id: validated_id, nb_particles: 345678, particle_min_area_px: 1, particle_max_area_px: 4000 })
            await create('pacific_002', P1, { latitude: -10, longitude: 179.5, sampling_utc_date_time: '2023-01-05T23:30:00Z', max_pressure: 80 },
                { ctd_imported: 1, ctd_file_extension: 'ctd' })
            await create('pacific_003', P2, { latitude: 20, longitude: -179.5, sampling_utc_date_time: '2024-12-01T02:15:00Z', max_pressure: null },
                { ecotaxa_sample_imported: 1, ecotaxa_sample_id: 501 })
            await create('mooring_004', P2, { latitude: 0, longitude: -23, sampling_utc_date_time: '2024-06-30T12:00:00Z', max_pressure: 850, sample_type_id: time_type_id })
            // Positioned with its CTD: (45, 8) rather than (0, 0).
            await create('ctd_positioned_005', P3, { latitude: 0, longitude: 0, sampling_utc_date_time: '2024-03-15T06:00:00Z', max_pressure: 1200 },
                { use_ctd_coordinates: 1, ctd_latitude: 45, ctd_longitude: 8 })
            // Asks for the CTD position but the CTD file had none: the sample's own position stays.
            await create('ctd_without_position_006', P3, { latitude: 30, longitude: 30, sampling_utc_date_time: '2024-03-16T06:00:00Z', max_pressure: 300 },
                { use_ctd_coordinates: 1, ctd_latitude: null, ctd_longitude: null })

            for (const name of ['st_10', 'stX10', 'pct%50', 'pct50', 'back\\slash']) {
                await create(name, NAMES, { latitude: 0, longitude: 0, sampling_utc_date_time: '2024-01-01T00:00:00Z', max_pressure: 10 })
            }
        })

        test('maps the light rows the Explore page needs', async () => {
            const [ligurian] = await dataSource.getExploreSamples(query({ project_ids: [P1], sample_names: ['ligurian'] }))

            expect(ligurian).toEqual({
                sample_id: ids['ligurian_001'], sample_name: 'ligurian_001', project_id: P1, latitude: 43.4, longitude: 7.87,
                sampling_utc_date_time: '2024-06-12T10:20:00Z', max_pressure: 500, sample_type_label: 'Depth', visual_qc_status_label: 'VALIDATED',
                ctd_imported: false, ctd_file_extension: null, ecotaxa_sample_imported: false, ecotaxa_sample_id: null,
                nb_vignettes: 0, nb_particles: 345678, particle_min_area_px: 1, particle_max_area_px: 4000,
                filter_first_image: '3432', filter_last_image: '107843', instrument_settings_depth_offset_m: 999,
                instrument_settings_image_volume_l: 0.63, instrument_settings_aa: 1130, instrument_settings_exp: 1.313,
                instrument_settings_particule_minimum_area_pixels: 2,
            })
            const [pacific] = await dataSource.getExploreSamples(query({ sample_names: ['pacific_002'] }))
            expect(pacific).toMatchObject({ ctd_imported: true, ctd_file_extension: 'ctd', visual_qc_status_label: 'PENDING', nb_particles: null })
        })

        test('filters by sample type', async () => {
            expect(await names()).toEqual(['ligurian_001', 'pacific_002', 'pacific_003', 'ctd_positioned_005', 'ctd_without_position_006'])
            expect(await names({ sample_type_label: 'Time' })).toEqual(['mooring_004'])
        })

        test('filters by project; an empty list matches nothing, null every project', async () => {
            expect(await names({ project_ids: [P2] })).toEqual(['pacific_003'])
            expect(await names({ project_ids: [] })).toEqual([])
            const everywhere = await names({ project_ids: null })
            expect(everywhere).toEqual(expect.arrayContaining(['ligurian_001', 'pacific_003', 'ctd_positioned_005', 'st_10']))
        })

        test('filters by bounding box, on the CTD position when the sample uses it', async () => {
            expect(await names({ bounds: { north: 50, south: 40, east: 10, west: 5 } })).toEqual(['ligurian_001', 'ctd_positioned_005'])
            expect(await names({ bounds: { north: 1, south: -1, east: 1, west: -1 } })).toEqual([])
            expect(await names({ bounds: { north: 31, south: 29, east: 31, west: 29 } })).toEqual(['ctd_without_position_006'])
        })

        test('a bounding box crossing the antimeridian keeps both sides', async () => {
            expect(await names({ bounds: { north: 30, south: -20, east: -170, west: 170 } })).toEqual(['pacific_002', 'pacific_003'])
        })

        test('returns the CTD coordinates of a sample that uses them', async () => {
            const [positioned] = await dataSource.getExploreSamples(query({ sample_names: ['ctd_positioned'] }))
            expect(positioned).toMatchObject({ latitude: 45, longitude: 8 })
            const [without] = await dataSource.getExploreSamples(query({ sample_names: ['ctd_without_position'] }))
            expect(without).toMatchObject({ latitude: 30, longitude: 30 })
        })

        test('filters by dates, both inclusive', async () => {
            expect(await names({ date_from: '2024-01-01' })).toEqual(['ligurian_001', 'pacific_003', 'ctd_positioned_005', 'ctd_without_position_006'])
            expect(await names({ date_to: '2024-06-12' })).toEqual(['ligurian_001', 'pacific_002', 'ctd_positioned_005', 'ctd_without_position_006'])
            expect(await names({ date_from: '2024-06-12', date_to: '2024-06-12' })).toEqual(['ligurian_001'])
        })

        test('filters by month, whatever the year', async () => {
            expect(await names({ months: [12, 1] })).toEqual(['pacific_002', 'pacific_003'])
            expect(await names({ months: [3] })).toEqual(['ctd_positioned_005', 'ctd_without_position_006'])
        })

        test('filters by sample name fragments, any of them', async () => {
            expect(await names({ sample_names: ['pacific', 'ligurian'] })).toEqual(['ligurian_001', 'pacific_002', 'pacific_003'])
            expect(await names({ sample_names: ['PACIFIC_00'] })).toEqual(['pacific_002', 'pacific_003'])
        })

        test('an underscore, a percent sign or a backslash in a fragment are literal', async () => {
            const named = (fragment: string) => names({ project_ids: [NAMES], sample_names: [fragment] })
            expect(await named('st_1')).toEqual(['st_10'])
            expect(await named('t%5')).toEqual(['pct%50'])
            expect(await named('%')).toEqual(['pct%50'])
            expect(await named('k\\s')).toEqual(['back\\slash'])
        })

        test('filters by hour of the day, UTC', async () => {
            expect(await names({ hour_range: [10, 11] })).toEqual(['ligurian_001'])
            expect(await names({ hour_range: [6, 6] })).toEqual(['ctd_positioned_005', 'ctd_without_position_006'])
        })

        test('an hour range crossing midnight keeps both ends of the day', async () => {
            expect(await names({ hour_range: [22, 3] })).toEqual(['pacific_002', 'pacific_003'])
        })

        test('keeps a sample when its profile reaches the pressure range, never one without pressure', async () => {
            expect(await names({ pressure_range: [100, 1000] })).toEqual(['ligurian_001', 'ctd_positioned_005', 'ctd_without_position_006'])
            expect(await names({ pressure_range: [0, 50] })).toEqual(['ligurian_001', 'pacific_002', 'ctd_positioned_005', 'ctd_without_position_006'])
            expect(await names({ pressure_range: [1000, 2000] })).toEqual(['ctd_positioned_005'])
        })

        test('CTD only, EcoTaxa imported only', async () => {
            expect(await names({ ctd_only: true })).toEqual(['pacific_002'])
            const [imported] = await dataSource.getExploreSamples(query({ ecotaxa_imported_only: true }))
            expect(imported).toMatchObject({ sample_name: 'pacific_003', ecotaxa_sample_imported: true, ecotaxa_sample_id: 501 })
        })

        test('criteria combine', async () => {
            expect(await names({ date_from: '2024-01-01', months: [6], bounds: { north: 50, south: 40, east: 10, west: 5 }, pressure_range: [100, 600] })).toEqual(['ligurian_001'])
        })

        test('countSamplesPerProject: the given projects only, or every project with null', async () => {
            const some = await dataSource.countSamplesPerProject([P1, P2, 424242])
            expect(Array.from(some.entries()).sort((a, b) => a[0] - b[0])).toEqual([[P1, 2], [P2, 2]])

            expect((await dataSource.countSamplesPerProject([])).size).toBe(0)

            const all = await dataSource.countSamplesPerProject(null)
            expect(all.get(P1)).toBe(2)
            expect(all.get(P3)).toBe(2)
            expect(all.get(NAMES)).toBe(5)
            expect(all.get(sampleRequestCreationModel_1.project_id)).toBeGreaterThan(0)
        })
    })

    describe('Explore queries on legacy sampling dates', () => {
        // Samples imported before the ISO conversion keep the UVP formats: "20120520080213" (UVP5),
        // "20230406-144332-820" (UVP6). The Explore query reads them as ISO date-times.
        const P_LEGACY = 9005
        const query = (overrides: Partial<ExploreSampleQuery> = {}): ExploreSampleQuery => ({
            sample_type_label: 'Depth', project_ids: [P_LEGACY], bounds: null, date_from: null, date_to: null, months: [], sample_names: [],
            hour_range: null, pressure_range: null, ctd_only: false, ecotaxa_imported_only: false, ...overrides,
        })
        const names = async (overrides: Partial<ExploreSampleQuery> = {}) => (await dataSource.getExploreSamples(query(overrides))).map(sample => sample.sample_name).sort()

        beforeAll(async () => {
            const depth_type_id = await new Promise<number>((resolve, reject) =>
                db.get("SELECT sample_type_id AS id FROM sample_type WHERE sample_type_label = 'Depth'", [], (e, row: any) => e ? reject(e) : resolve(row.id)))
            for (const [sample_name, sampling_utc_date_time] of [['legacy_uvp5', '20120520080213'], ['legacy_uvp6', '20230406-144332-820'], ['iso_sample', '2024-06-12T10:20:00Z']]) {
                await dataSource.createOne({ ...sampleRequestCreationModel_1, sample_name, project_id: P_LEGACY, sample_type_id: depth_type_id, sampling_utc_date_time })
            }
        })

        test('the dates come back as ISO date-times', async () => {
            const rows = await dataSource.getExploreSamples(query())
            const dates = Object.fromEntries(rows.map(row => [row.sample_name, row.sampling_utc_date_time]))
            expect(dates).toEqual({ legacy_uvp5: '2012-05-20T08:02:13Z', legacy_uvp6: '2023-04-06T14:43:32Z', iso_sample: '2024-06-12T10:20:00Z' })
        })

        test('date, month and hour criteria apply to the legacy formats', async () => {
            expect(await names({ date_from: '2012-05-20', date_to: '2012-05-20' })).toEqual(['legacy_uvp5'])
            expect(await names({ months: [4, 6] })).toEqual(['iso_sample', 'legacy_uvp6'])
            expect(await names({ hour_range: [14, 15] })).toEqual(['legacy_uvp6'])
        })
    })

    describe('EcoTaxa stats (table sample_ecotaxa_stats)', () => {
        // A project of its own: other describes flag samples as imported in EcoTaxa too.
        const P_STATS = 9006
        let with_id: number
        let without_id: number
        let not_imported: number

        const stats = (sample_id: number, ecotaxa_sample_id: number, overrides: Partial<StoredEcoTaxaStats> = {}): StoredEcoTaxaStats => ({
            sample_id, ecotaxa_sample_id, nb_unclassified: 1, nb_validated: 2, nb_dubious: 3, nb_predicted: 4, used_taxa: [1, 2, 3],
            fetched_utc_date_time: '2026-10-21T08:00:00.000Z', ...overrides,
        })
        const rawRows = (sample_id: number): Promise<any[]> => new Promise((resolve, reject) =>
            db.all('SELECT * FROM sample_ecotaxa_stats WHERE sample_id = ?', [sample_id], (e, rows) => e ? reject(e) : resolve(rows)))

        beforeAll(async () => {
            const create = async (sample_name: string, columns: Record<string, unknown>): Promise<number> => {
                const id = await dataSource.createOne({ ...sampleRequestCreationModel_1, sample_name, project_id: P_STATS })
                await run(db, `UPDATE sample SET ${Object.keys(columns).map(name => `${name} = ?`).join(', ')} WHERE sample_id = ?`, [...Object.values(columns), id])
                return id
            }
            with_id = await create('stats_with_id', { ecotaxa_sample_imported: 1, ecotaxa_sample_id: 7001 })
            without_id = await create('stats_without_id', { ecotaxa_sample_imported: 1, ecotaxa_sample_id: null })
            not_imported = await create('stats_not_imported', { ecotaxa_sample_imported: 0, ecotaxa_sample_id: 7003 })
        })

        test('upsertEcoTaxaStats inserts, then replaces the row of the same sample', async () => {
            await dataSource.upsertEcoTaxaStats([stats(with_id, 7001)])
            expect(await dataSource.getEcoTaxaStats([with_id])).toEqual([stats(with_id, 7001)])

            const refreshed = stats(with_id, 7002, { nb_validated: 20, nb_predicted: 0, used_taxa: [], fetched_utc_date_time: '2026-10-22T08:00:00.000Z' })
            await dataSource.upsertEcoTaxaStats([refreshed])

            expect(await dataSource.getEcoTaxaStats([with_id])).toEqual([refreshed])
            expect(await rawRows(with_id)).toHaveLength(1)
        })

        test('upsertEcoTaxaStats writes several samples at once, and nothing for an empty list', async () => {
            await dataSource.upsertEcoTaxaStats([])
            await dataSource.upsertEcoTaxaStats([stats(with_id, 7001), stats(not_imported, 7003, { used_taxa: [45072] })])

            const rows = (await dataSource.getEcoTaxaStats([not_imported, with_id])).sort((a, b) => a.sample_id - b.sample_id)
            expect(rows).toEqual([stats(with_id, 7001), stats(not_imported, 7003, { used_taxa: [45072] })].sort((a, b) => a.sample_id - b.sample_id))
        })

        test('used_taxa is kept as a comma-separated list: "1,2,3" reads [1, 2, 3], "" reads []', async () => {
            await dataSource.upsertEcoTaxaStats([stats(with_id, 7001, { used_taxa: [1, 2, 3] }), stats(without_id, 7002, { used_taxa: [] })])
            expect((await rawRows(with_id))[0].used_taxa).toBe('1,2,3')
            expect((await rawRows(without_id))[0].used_taxa).toBe('')

            const rows = await dataSource.getEcoTaxaStats([with_id, without_id])
            expect(rows.find(row => row.sample_id === with_id)?.used_taxa).toEqual([1, 2, 3])
            expect(rows.find(row => row.sample_id === without_id)?.used_taxa).toEqual([])
        })

        test('getEcoTaxaStats: nothing for an empty list or samples without stats', async () => {
            await expect(dataSource.getEcoTaxaStats([])).resolves.toEqual([])
            await expect(dataSource.getEcoTaxaStats([424242])).resolves.toEqual([])
        })

        test('listEcoTaxaImportedSamples: only the samples imported in EcoTaxa, with the date of their stats or null', async () => {
            await run(db, 'DELETE FROM sample_ecotaxa_stats WHERE sample_id IN (?, ?, ?)', [with_id, without_id, not_imported])
            await dataSource.upsertEcoTaxaStats([stats(with_id, 7001, { fetched_utc_date_time: '2026-10-20T06:00:00.000Z' }), stats(not_imported, 7003)])

            const listed = await dataSource.listEcoTaxaImportedSamples()

            expect(listed.filter(sample => sample.project_id === P_STATS)).toEqual([
                { sample_id: with_id, sample_name: 'stats_with_id', project_id: P_STATS, ecotaxa_sample_id: 7001, fetched_utc_date_time: '2026-10-20T06:00:00.000Z' },
                { sample_id: without_id, sample_name: 'stats_without_id', project_id: P_STATS, ecotaxa_sample_id: null, fetched_utc_date_time: null },
            ])
            expect(listed.some(sample => sample.sample_id === not_imported)).toBe(false)
            // Samples of the other describes, flagged imported there, are listed too.
            expect(listed.some(sample => sample.sample_name === 'pacific_003')).toBe(true)
            const ids = listed.map(sample => sample.sample_id)
            expect(ids).toEqual([...ids].sort((a, b) => a - b))
        })

        test('deleting a sample deletes its stats (foreign keys on, as in production)', async () => {
            // The suite runs with foreign keys off (its fixture points at a project and a user it does not
            // seed); the application turns them on at start, so this case does as well, for itself only.
            const doomed = await dataSource.createOne({ ...sampleRequestCreationModel_1, sample_name: 'stats_deleted', project_id: P_STATS })
            await dataSource.upsertEcoTaxaStats([stats(doomed, 7009)])
            expect(await rawRows(doomed)).toHaveLength(1)
            await run(db, 'PRAGMA foreign_keys = ON')
            try {
                await run(db, 'DELETE FROM sample WHERE sample_id = ?', [doomed])
            } finally {
                await run(db, 'PRAGMA foreign_keys = OFF')
            }

            expect(await rawRows(doomed)).toEqual([])
            await expect(dataSource.getEcoTaxaStats([doomed])).resolves.toEqual([])
        })
    })
})
