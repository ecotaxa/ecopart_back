// getSamplesByIds on a real migrated SQLite DB: an export may list tens of thousands of sample ids,
// over SQLite's 32 766 variables per statement once the IN list is bound twice.
import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { MigrationManager } from '../../../src/data/migrations/migration-manager'
import { SQLiteProjectDataSource } from '../../../src/data/data-sources/sqlite/sqlite-project-data-source'
import { SQLiteSampleDataSource } from '../../../src/data/data-sources/sqlite/sqlite-sample-data-source'
import { SampleRepositoryImpl } from '../../../src/domain/repositories/sample-repository'
import { sampleRequestCreationModel_1 } from '../../entities/sample'

const DBFILE = 'TEST_DB_SAMPLE_IDS_LOOKUP'

describe('SampleRepository.getSamplesByIds (integration)', () => {
    let db: sqlite3.Database
    let repository: SampleRepositoryImpl
    const sample_ids: number[] = []

    beforeAll(async () => {
        db = new sqlite3.Database(DBFILE)
        await new MigrationManager(db).runAllMigrations(path.resolve(__dirname, '../../../src/data/migrations'))

        const project_id = await new SQLiteProjectDataSource(db).create({
            root_folder_path: '/r', project_title: 'Large selection', project_acronym: 'AC',
            project_description: 'd', cruise: 'cr', ship: 'sh',
            data_owner_name: 'o', data_owner_email: 'o@e.com',
            operator_name: 'op', operator_email: 'op@e.com',
            chief_scientist_name: 'cs', chief_scientist_email: 'cs@e.com',
            override_depth_offset: undefined, enable_descent_filter: false,
            privacy_duration: 1, visible_duration: 1, public_duration: 1,
            instrument_model: 1, serial_number: 'sn',
            ecotaxa_project_id: undefined, ecotaxa_project_name: undefined, ecotaxa_instance_id: undefined,
        } as any)
        const samples = new SQLiteSampleDataSource(db)
        for (const sample_name of ['s1', 's2', 's3']) {
            sample_ids.push(await samples.createOne({ ...sampleRequestCreationModel_1, project_id, sample_name }))
        }
        repository = new SampleRepositoryImpl(samples, 'fs')
    })

    afterAll(() => { try { fs.unlinkSync(DBFILE) } catch { /* ignore */ } })

    test('20 000 requested ids are looked up without exceeding the SQL variable limit', async () => {
        const unknown_ids = Array.from({ length: 20_000 }, (_, i) => 1_000_000 + i)

        const found = await repository.getSamplesByIds([...unknown_ids.slice(0, 7_000), sample_ids[0], ...unknown_ids.slice(7_000), sample_ids[1], sample_ids[2]])

        expect(found.map(s => s.sample_id).sort((a, b) => a - b)).toEqual(sample_ids)
    })

    test('a short list still returns its samples', async () => {
        const found = await repository.getSamplesByIds([sample_ids[1]])

        expect(found.map(s => s.sample_name)).toEqual(['s2'])
    })
})
