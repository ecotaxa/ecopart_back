// Rollback of the EcoTaxa import flags on a real migrated SQLite DB: it resets every sample the task
// flagged, and nothing in another project, even where a sample has the same name.
import sqlite3 from 'sqlite3'
import path from 'path'
import { MigrationManager } from '../../../../src/data/migrations/migration-manager'
import { SQLiteProjectDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-project-data-source'
import { SQLiteSampleDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-sample-data-source'
import { SampleRepositoryImpl } from '../../../../src/domain/repositories/sample-repository'
import { ImportEcoTaxaSamples } from '../../../../src/domain/use-cases/ecotaxa_sample/import-ecotaxa-samples'
import { MockUserRepository, MockEcotaxaAccountRepository } from '../../../mocks/user-mock'
import { MockPrivilegeRepository } from '../../../mocks/privilege-mock'
import { MockProjectRepository } from '../../../mocks/project-mock'
import { MockTaskRepository } from '../../../mocks/task-mock'
import { sampleRequestCreationModel_1 } from '../../../entities/sample'
import { TaskResponseModel_1 } from '../../../entities/task'

describe('EcoTaxa import rollback (integration)', () => {
    let db: sqlite3.Database
    let repository: SampleRepositoryImpl
    let useCase: ImportEcoTaxaSamples

    async function createProject(project_title: string): Promise<number> {
        return new SQLiteProjectDataSource(db).create({
            root_folder_path: '/r', project_title, project_acronym: 'AC',
            project_description: 'd', cruise: 'cr', ship: 'sh',
            data_owner_name: 'o', data_owner_email: 'o@e.com',
            operator_name: 'op', operator_email: 'op@e.com',
            chief_scientist_name: 'cs', chief_scientist_email: 'cs@e.com',
            override_depth_offset: undefined, enable_descent_filter: false,
            privacy_duration: 1, visible_duration: 1, public_duration: 1,
            instrument_model: 1, serial_number: 'sn',
            ecotaxa_project_id: undefined, ecotaxa_project_name: undefined, ecotaxa_instance_id: undefined,
        } as any)
    }
    async function importedInEcoTaxa(sample_id: number): Promise<boolean> {
        return (await repository.getSamplesByIds([sample_id]))[0].ecotaxa_sample_imported
    }

    beforeEach(async () => {
        db = new sqlite3.Database(':memory:')
        await new MigrationManager(db, new Proxy({}, { get: () => () => undefined }) as any)
            .runAllMigrations(path.resolve(__dirname, '../../../../src/data/migrations'))
        repository = new SampleRepositoryImpl(new SQLiteSampleDataSource(db), 'fs')
        const taskRepository = new MockTaskRepository()
        jest.spyOn(taskRepository, 'logMessage').mockResolvedValue()
        useCase = new ImportEcoTaxaSamples(repository, new MockUserRepository(), new MockPrivilegeRepository(), new MockProjectRepository(), taskRepository, new MockEcotaxaAccountRepository(), 'fs')
    })

    afterEach(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()))
    })

    test('every sample flagged by the task is reset, a namesake in another project is left alone', async () => {
        const this_project = await createProject('This one')
        const other_project = await createProject('Other one')
        const samples = new SQLiteSampleDataSource(db)
        const s1 = await samples.createOne({ ...sampleRequestCreationModel_1, project_id: this_project, sample_name: 's1' })
        const s2 = await samples.createOne({ ...sampleRequestCreationModel_1, project_id: this_project, sample_name: 's2' })
        const namesake = await samples.createOne({ ...sampleRequestCreationModel_1, project_id: other_project, sample_name: 's1' })
        // the namesake was imported into EcoTaxa earlier, s1 and s2 are flagged by the failing task
        await repository.createManyEcoTaxaSamples([s1, s2, namesake].map(sample_id => ({ sample_id, ecotaxa_sample_imported: true })))

        const to_import = [s1, s2].map((sample_id, i) => ({ sample_id, sample_name: `s${i + 1}`, tsv_file_name: 't', local_folder_tsv_path: 'p', images: 1 }))
        await (useCase as any).deleteEcoTaxaSamplesFromDb(TaskResponseModel_1, to_import, new Error('EcoTaxa is down'))

        expect(await importedInEcoTaxa(s1)).toBe(false)
        expect(await importedInEcoTaxa(s2)).toBe(false)
        expect(await importedInEcoTaxa(namesake)).toBe(true)
    })
})
