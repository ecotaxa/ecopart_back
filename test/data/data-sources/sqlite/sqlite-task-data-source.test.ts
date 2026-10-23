import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { MigrationManager } from '../../../../src/data/migrations/migration-manager'
import { SQLiteTaskDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-task-data-source'
import { TaskRepositoryImpl } from '../../../../src/domain/repositories/task-repository'

const DBFILE = 'TEST_DB_SOURCE_TASK'

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise<void>((resolve, reject) => db.run(sql, params, (e) => e ? reject(e) : resolve()))
}

describe('SQLiteTaskDataSource', () => {
    let db: sqlite3.Database
    let dataSource: SQLiteTaskDataSource

    const typeId = (label: string): Promise<number> => new Promise((resolve, reject) =>
        db.get('SELECT task_type_id AS id FROM task_type WHERE task_type_label = ?', [label], (e, row: any) => e ? reject(e) : resolve(row.id)))

    beforeAll(async () => {
        db = new sqlite3.Database(DBFILE)
        await new MigrationManager(db).runAllMigrations(path.resolve(__dirname, '../../../../src/data/migrations'))
        // The tasks point at a project and an owner this test does not seed.
        await run(db, 'PRAGMA foreign_keys = OFF')
        dataSource = new SQLiteTaskDataSource(db)
        const tasks: [string, number, number][] = [
            ['EXPORT', 1, 5], ['EXPORT', 1, 5], ['EXPORT_RAW', 1, 1], ['EXPORT_BACKUP', 1, 6], ['IMPORT', 1, 5], ['IMPORT_CTD', 1, 5],
            ['EXPORT', 2, 5],
        ]
        for (const [label, project_id, status_id] of tasks) {
            await run(db, `INSERT INTO task (task_type_id, task_status_id, task_owner_id, task_project_id, task_creation_utc_date_time) VALUES (?, ?, 1, ?, '2026-01-01T00:00:00Z')`,
                [await typeId(label), status_id, project_id])
        }
    })

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()))
        if (fs.existsSync(DBFILE)) fs.unlinkSync(DBFILE)
    })

    test('countTasksByType: the tasks of the project per type label, most frequent first', async () => {
        expect(await dataSource.countTasksByType(1)).toEqual([
            { label: 'EXPORT', count: 2 },
            { label: 'EXPORT_BACKUP', count: 1 },
            { label: 'EXPORT_RAW', count: 1 },
            { label: 'IMPORT', count: 1 },
            { label: 'IMPORT_CTD', count: 1 },
        ])
        expect(await dataSource.countTasksByType(2)).toEqual([{ label: 'EXPORT', count: 1 }])
        expect(await dataSource.countTasksByType(3)).toEqual([])
    })

    test('countExportTasks: the export types only, whatever their status', async () => {
        const repository = new TaskRepositoryImpl(dataSource, {} as any, 'data_storage')
        expect(await repository.countExportTasks(1)).toBe(4)
        expect(await repository.countExportTasks(3)).toBe(0)
    })
})
