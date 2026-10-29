// Integration test for the task lifecycle (repository -> data source -> sqlite), on a migrated
// in-memory database and a temporary log folder: status transitions, cancellation, the active-task
// queries used by the backup conflict check and the startup recovery, and the task search of a
// non-admin user (which failed with an SQL error before the visibility rule was resolved to ids).
import sqlite3 from 'sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { MigrationManager } from '../../../src/data/migrations/migration-manager'
import { SQLiteTaskDataSource } from '../../../src/data/data-sources/sqlite/sqlite-task-data-source'
import { SQLiteProjectDataSource } from '../../../src/data/data-sources/sqlite/sqlite-project-data-source'
import { TaskRepositoryImpl } from '../../../src/domain/repositories/task-repository'
import { SearchRepositoryImpl } from '../../../src/domain/repositories/search-repository'
import { SearchTask } from '../../../src/domain/use-cases/task/search-tasks'
import { FsAdapter } from '../../../src/infra/files/fs'
import { TasksStatus, TaskType } from '../../../src/domain/entities/task'
import { TASK_CANCELLED_MESSAGE } from '../../../src/domain/constants/task'
import { migration as migration028 } from '../../../src/data/migrations/028_task_cancellation_and_unused_cleanup'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<number> {
    return new Promise<number>((resolve, reject) =>
        db.run(sql, params, function (this: sqlite3.RunResult, e) { e ? reject(e) : resolve(this.lastID) }))
}

describe('task repository (integration)', () => {
    let db: sqlite3.Database
    let tmp_dir: string
    let taskDs: SQLiteTaskDataSource
    let taskRepo: TaskRepositoryImpl
    let owner_id: number
    let other_user_id: number
    let project_1: number
    let project_2: number

    // project_id null: a cross-project task (an undefined argument would fall back to the default)
    async function newTask(task_type: TaskType = TaskType.Import, project_id: number | null = project_1, task_owner_id = owner_id): Promise<number> {
        return taskRepo.createTask({ task_type, task_status: TasksStatus.Pending, task_owner_id, task_project_id: project_id ?? undefined, task_params: {} })
    }
    async function statusOf(task_id: number): Promise<string | undefined> {
        return (await taskRepo.getOneTask({ task_id }))?.task_status
    }
    async function logOf(task_id: number): Promise<string> {
        return taskRepo.getLogFileTask(task_id)
    }

    beforeEach(async () => {
        db = new sqlite3.Database(':memory:')
        await run(db, 'PRAGMA foreign_keys = ON;')
        await new MigrationManager(db, new Proxy({}, { get: () => () => undefined }) as any)
            .runAllMigrations(path.resolve(PROJECT_ROOT, 'src/data/migrations'))

        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecopart-tasks-'))
        taskDs = new SQLiteTaskDataSource(db)
        taskRepo = new TaskRepositoryImpl(taskDs, new FsAdapter(), path.relative(PROJECT_ROOT, tmp_dir))

        owner_id = await run(db, `INSERT INTO user (first_name,last_name,email,password_hash,valid_email,is_admin,organisation,country,user_planned_usage)
            VALUES ('Jane','Doe','jane@doe.com','x',1,0,'org','FR','research')`)
        other_user_id = await run(db, `INSERT INTO user (first_name,last_name,email,password_hash,valid_email,is_admin,organisation,country,user_planned_usage)
            VALUES ('John','Roe','john@roe.com','x',1,0,'org','FR','research')`)
        const projectDs = new SQLiteProjectDataSource(db)
        const insertProject = (project_title: string) => projectDs.create({
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
        project_1 = await insertProject('Alpha')
        project_2 = await insertProject('Beta')
    })

    afterEach(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()))
        fs.rmSync(tmp_dir, { recursive: true, force: true })
    })

    describe('migration 028', () => {
        test('statuses and types match the model, the unused columns are gone', async () => {
            const all = (sql: string) => new Promise<any[]>((resolve, reject) => db.all(sql, [], (e, rows) => e ? reject(e) : resolve(rows)))
            const statuses = (await all('SELECT task_status_label FROM task_status ORDER BY task_status_label')).map(r => r.task_status_label)
            expect(statuses).toEqual(Object.values(TasksStatus).sort())
            const types = (await all('SELECT task_type_label FROM task_type ORDER BY task_type_label')).map(r => r.task_type_label)
            expect(types).toEqual(Object.values(TaskType).sort())
            const columns = (await all('PRAGMA table_info(task)')).map(r => r.name)
            expect(columns).not.toContain('task_question')
            expect(columns).not.toContain('task_reply')
            expect(columns).not.toContain('task_step')
        })

        test('down restores the previous schema, failing cancelled tasks; up runs again cleanly', async () => {
            const all = (sql: string) => new Promise<any[]>((resolve, reject) => db.all(sql, [], (e, rows) => e ? reject(e) : resolve(rows)))
            const cancelled = await newTask()
            await taskRepo.cancelTask(cancelled)

            await migration028.down(db)
            const labels = (await all('SELECT task_status_label FROM task_status')).map(r => r.task_status_label)
            expect(labels).toEqual(expect.arrayContaining(['VALIDATING', 'WAITING_FOR_RESPONSE']))
            expect(labels).not.toContain('CANCELLED')
            expect((await all('PRAGMA table_info(task)')).map(r => r.name)).toEqual(expect.arrayContaining(['task_question', 'task_reply', 'task_step']))
            expect(await statusOf(cancelled)).toBe('ERROR')

            await migration028.up(db)
            await migration028.up(db)
            expect((await all('SELECT task_status_label FROM task_status ORDER BY task_status_label')).map(r => r.task_status_label)).toEqual(Object.values(TasksStatus).sort())
        })
    })

    describe('lifecycle', () => {
        test('a task runs from PENDING to DONE, with its dates set', async () => {
            const task_id = await newTask()
            await taskRepo.startTask({ task_id })
            await taskRepo.finishTask({ task_id }, 'result')

            const task = await taskRepo.getOneTask({ task_id })
            expect(task?.task_status).toBe(TasksStatus.Done)
            expect(task?.task_start_utc_date_time).toBeTruthy()
            expect(task?.task_end_utc_date_time).toBeTruthy()
            expect(task?.task_result).toBe('result')
        })

        test('a pending task can fail before it starts', async () => {
            const task_id = await newTask()
            await taskRepo.failedTask(task_id, new Error('boom'))
            const task = await taskRepo.getOneTask({ task_id })
            expect(task?.task_status).toBe(TasksStatus.Error)
            expect(task?.task_error).toBe('boom')
        })

        test('the log, the error and the result quote paths relative to the application root', async () => {
            const server_path = path.join(PROJECT_ROOT, 'data_storage', 'tasks', '1', 'export.zip')
            const failing = await newTask()
            await taskRepo.logMessage((await taskRepo.getOneTask({ task_id: failing }))?.task_log_file_path, `Exported at: ${server_path}`)
            await taskRepo.failedTask(failing, new Error(`ENOENT: no such file or directory, open '${server_path}'`))

            expect((await taskRepo.getOneTask({ task_id: failing }))?.task_error).toBe("ENOENT: no such file or directory, open 'data_storage/tasks/1/export.zip'")
            const log = await logOf(failing)
            expect(log).toContain('Exported at: data_storage/tasks/1/export.zip')
            expect(log).toContain("open 'data_storage/tasks/1/export.zip'")
            expect(log).not.toContain(PROJECT_ROOT)

            const done = await newTask()
            await taskRepo.startTask({ task_id: done })
            await taskRepo.finishTask({ task_id: done }, `${server_path} https://ecopart.example.org/api/tasks/1/file`)
            expect((await taskRepo.getOneTask({ task_id: done }))?.task_result).toBe('data_storage/tasks/1/export.zip https://ecopart.example.org/api/tasks/1/file')
        })

        test('a final status cannot change any more', async () => {
            const task_id = await newTask()
            await taskRepo.startTask({ task_id })
            await taskRepo.finishTask({ task_id })
            await expect(taskRepo.statusManager({ task_id }, TasksStatus.Running)).rejects.toThrow('Cannot change status from DONE to RUNNING')
        })

        test('the status write is conditional on the status it was decided from', async () => {
            const task_id = await newTask()
            const task = await taskRepo.getOneTask({ task_id })
            // Another writer moved the task on: an update expecting PENDING is a no-op
            await taskRepo.startTask({ task_id })
            expect(await taskDs.updateOne({ task_id, task_progress_msg: 'stale' }, task!.task_status_id)).toBe(0)
            expect((await taskRepo.getOneTask({ task_id }))?.task_progress_msg).not.toBe('stale')
        })
    })

    describe('cancellation', () => {
        test('a pending task is cancelled at once and its work does not start', async () => {
            const task_id = await newTask()
            await taskRepo.cancelTask(task_id)

            const task = await taskRepo.getOneTask({ task_id })
            expect(task?.task_status).toBe(TasksStatus.Cancelled)
            expect(task?.task_end_utc_date_time).toBeTruthy()
            await expect(taskRepo.startTask({ task_id })).rejects.toThrow(TASK_CANCELLED_MESSAGE)
            // The worker's catch: nothing more to record on a task already cancelled
            await taskRepo.failedTask(task_id, new Error(TASK_CANCELLED_MESSAGE))
            expect(await statusOf(task_id)).toBe(TasksStatus.Cancelled)
            expect(await logOf(task_id)).toContain('Task cancelled before it started')
        })

        test('a running task goes CANCELLING, stops at its checkpoint and ends CANCELLED', async () => {
            const task_id = await newTask()
            await taskRepo.startTask({ task_id })
            await expect(taskRepo.throwIfCancelled(task_id)).resolves.toBeUndefined()

            await taskRepo.cancelTask(task_id)
            expect(await statusOf(task_id)).toBe(TasksStatus.Cancelling)

            const checkpoint = taskRepo.throwIfCancelled(task_id)
            await expect(checkpoint).rejects.toThrow(TASK_CANCELLED_MESSAGE)
            await taskRepo.failedTask(task_id, await checkpoint.catch(e => e))

            const task = await taskRepo.getOneTask({ task_id })
            expect(task?.task_status).toBe(TasksStatus.Cancelled)
            expect(task?.task_error).toBeFalsy()
            expect(task?.task_end_utc_date_time).toBeTruthy()
            expect(await logOf(task_id)).toContain('Task cancelled')
        })

        test('a cancelling task that reaches its end before a checkpoint still completes', async () => {
            const task_id = await newTask()
            await taskRepo.startTask({ task_id })
            await taskRepo.cancelTask(task_id)
            await taskRepo.finishTask({ task_id })
            expect(await statusOf(task_id)).toBe(TasksStatus.Done)
        })

        test('a cancelling task that fails for another reason ends in ERROR', async () => {
            const task_id = await newTask()
            await taskRepo.startTask({ task_id })
            await taskRepo.cancelTask(task_id)
            await taskRepo.failedTask(task_id, new Error('disk full'))
            const task = await taskRepo.getOneTask({ task_id })
            expect(task?.task_status).toBe(TasksStatus.Error)
            expect(task?.task_error).toBe('disk full')
        })

        test('a finished or already cancelling task cannot be cancelled', async () => {
            const done_id = await newTask()
            await taskRepo.startTask({ task_id: done_id })
            await taskRepo.finishTask({ task_id: done_id })
            await expect(taskRepo.cancelTask(done_id)).rejects.toThrow('Task cannot be cancelled')

            const cancelling_id = await newTask()
            await taskRepo.startTask({ task_id: cancelling_id })
            await taskRepo.cancelTask(cancelling_id)
            await expect(taskRepo.cancelTask(cancelling_id)).rejects.toThrow('Task cannot be cancelled')
        })
    })

    describe('deletion', () => {
        test('an unfinished task is refused with its current status, a finished one is deleted', async () => {
            const task_id = await newTask()
            await expect(taskRepo.deleteTask({ task_id })).rejects.toThrow(`Task ${task_id} is still PENDING: cancel it before deleting it.`)
            await taskRepo.startTask({ task_id })
            await expect(taskRepo.deleteTask({ task_id })).rejects.toThrow(`Task ${task_id} is still RUNNING: cancel it before deleting it.`)
            await taskRepo.cancelTask(task_id)
            await expect(taskRepo.deleteTask({ task_id })).rejects.toThrow(`Task ${task_id} is still CANCELLING: cancel it before deleting it.`)
            expect(await statusOf(task_id)).toBe(TasksStatus.Cancelling)

            const task_folder = path.join(tmp_dir, 'tasks', `${task_id}`)
            expect(fs.existsSync(path.join(task_folder, `task_log_${task_id}.log`))).toBe(true)

            await taskRepo.failedTask(task_id, new Error('cancelled'))
            expect(await taskRepo.deleteTask({ task_id })).toBe(1)
            expect(await taskRepo.getOneTask({ task_id })).toBeNull()
            expect(fs.existsSync(task_folder)).toBe(false)
        })

        test('a log stored in a former storage folder goes with its folder, a log elsewhere goes alone', async () => {
            const moved_id = await newTask()
            await taskRepo.failedTask(moved_id, new Error('boom'))
            const former_folder = path.join(tmp_dir, 'former', 'tasks', `${moved_id}`)
            fs.mkdirSync(former_folder, { recursive: true })
            fs.writeFileSync(path.join(former_folder, `ecopart_export_raw_${moved_id}.zip`), 'zip')
            await taskDs.updateOne({ task_id: moved_id, task_log_file_path: path.join(former_folder, `task_log_${moved_id}.log`) })

            expect(await taskRepo.deleteTask({ task_id: moved_id })).toBe(1)
            expect(fs.existsSync(former_folder)).toBe(false)
            expect(fs.existsSync(path.join(tmp_dir, 'tasks', `${moved_id}`))).toBe(false)

            const elsewhere_id = await newTask()
            await taskRepo.failedTask(elsewhere_id, new Error('boom'))
            const elsewhere = path.join(tmp_dir, 'elsewhere')
            fs.mkdirSync(elsewhere)
            fs.writeFileSync(path.join(elsewhere, 'task.log'), 'log')
            fs.writeFileSync(path.join(elsewhere, 'other.txt'), 'other')
            await taskDs.updateOne({ task_id: elsewhere_id, task_log_file_path: path.join(elsewhere, 'task.log') })

            expect(await taskRepo.deleteTask({ task_id: elsewhere_id })).toBe(1)
            expect(fs.readdirSync(elsewhere)).toEqual(['other.txt'])
        })

        test('the delete is conditional on the status it was decided from', async () => {
            const task_id = await newTask()
            const task = await taskRepo.getOneTask({ task_id })
            // The task started meanwhile: a delete expecting PENDING is a no-op
            await taskRepo.startTask({ task_id })
            expect(await taskDs.deleteOne({ task_id }, task!.task_status_id)).toBe(0)
            expect(await statusOf(task_id)).toBe(TasksStatus.Running)
        })

        test('a task that no longer exists deletes nothing', async () => {
            expect(await taskRepo.deleteTask({ task_id: 999 })).toBe(0)
        })
    })

    describe('active tasks', () => {
        test('hasActiveTask only sees pending, running or cancelling tasks of the given types and project', async () => {
            const backup = await newTask(TaskType.Import_Backup, project_1)
            expect(await taskRepo.hasActiveTask(project_1, [TaskType.Import_Backup, TaskType.Export_Backup])).toBe(true)
            expect(await taskRepo.hasActiveTask(project_2, [TaskType.Import_Backup, TaskType.Export_Backup])).toBe(false)
            expect(await taskRepo.hasActiveTask(project_1, [TaskType.Export_Raw])).toBe(false)

            await taskRepo.startTask({ task_id: backup })
            await taskRepo.cancelTask(backup)
            expect(await taskRepo.hasActiveTask(project_1, [TaskType.Import_Backup, TaskType.Export_Backup])).toBe(true)

            await taskRepo.finishTask({ task_id: backup })
            expect(await taskRepo.hasActiveTask(project_1, [TaskType.Import_Backup, TaskType.Export_Backup])).toBe(false)
        })

        test('two simultaneous backup requests on a project create a single task', async () => {
            const backup = (task_type: TaskType) => taskRepo.createTaskUnlessActive(
                { task_type, task_status: TasksStatus.Pending, task_owner_id: owner_id, task_project_id: project_1, task_params: {} },
                [TaskType.Import_Backup, TaskType.Export_Backup])

            const [import_id, export_id] = await Promise.all([backup(TaskType.Import_Backup), backup(TaskType.Export_Backup)])

            expect(import_id).toEqual(expect.any(Number))
            expect(export_id).toBeNull()
            // Another project is not concerned
            await expect(taskRepo.createTaskUnlessActive(
                { task_type: TaskType.Export_Backup, task_status: TasksStatus.Pending, task_owner_id: owner_id, task_project_id: project_2, task_params: {} },
                [TaskType.Import_Backup, TaskType.Export_Backup])).resolves.toEqual(expect.any(Number))
        })

        test('a task whose log cannot be written still ends in ERROR when it fails', async () => {
            const task_id = await newTask()
            // as if the server stopped between the task creation and the recording of its log path
            await taskDs.updateOne({ task_id, task_log_file_path: '' })

            await expect(taskRepo.failedTask(task_id, new Error('Task interrupted by a server restart'))).rejects.toThrow('No log file path found')
            const task = await taskRepo.getOneTask({ task_id })
            expect(task?.task_status).toBe(TasksStatus.Error)
            expect(task?.task_error).toBe('Task interrupted by a server restart')
        })

        test('getActiveTasks returns every non-final task', async () => {
            const pending = await newTask()
            const running = await newTask()
            const cancelling = await newTask()
            const done = await newTask()
            await taskRepo.startTask({ task_id: running })
            await taskRepo.startTask({ task_id: cancelling })
            await taskRepo.cancelTask(cancelling)
            await taskRepo.startTask({ task_id: done })
            await taskRepo.finishTask({ task_id: done })

            const active = await taskRepo.getActiveTasks()
            expect(active.map(t => t.task_id)).toEqual([pending, running, cancelling])
        })
    })

    describe('public task and search', () => {
        test('toPublicTask drops the server path of the log file', async () => {
            const task = await taskRepo.getOneTask({ task_id: await newTask() })
            expect(task?.task_log_file_path).toContain(tmp_dir)
            expect(taskRepo.toPublicTask(task!)).not.toHaveProperty('task_log_file_path')
        })

        test('the data source matches NULL in an IN list, and nothing for an empty list', async () => {
            const with_project = await newTask(TaskType.Import, project_1)
            const without_project = await newTask(TaskType.Export_Raw, null)
            await newTask(TaskType.Import, project_2)

            const ids = async (value: any[]) => (await taskDs.getAll({ filter: [{ field: 'task_project_id', operator: 'IN', value }], sort_by: [{ sort_by: 'task_id', order_by: 'asc' }], page: 1, limit: 10 })).items.map(t => t.task_id)
            expect(await ids([project_1, null])).toEqual([with_project, without_project])
            expect(await ids([null])).toEqual([without_project])
            expect(await ids([])).toEqual([])
        })

        test('a non-admin who can see more tasks than SQLite accepts bound values still gets a result', async () => {
            // 17000 visible tasks: binding their ids (twice, count and page) would exceed the 32766 limit
            await run(db, `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 17000)
                INSERT INTO task (task_type_id, task_status_id, task_owner_id, task_project_id, task_creation_utc_date_time)
                SELECT (SELECT task_type_id FROM task_type WHERE task_type_label = 'IMPORT'),
                       (SELECT task_status_id FROM task_status WHERE task_status_label = 'DONE'),
                       ?, ?, '2020-01-01T00:00:00Z' FROM n`, [owner_id, project_1])
            const userRepo: any = { ensureUserCanBeUsed: async () => undefined, isAdmin: async () => false }
            const privilegeRepo: any = { getProjectsByUser: async () => [project_1] }
            const searchTask = new SearchTask(userRepo, taskRepo, new SearchRepositoryImpl(), {} as any, privilegeRepo)

            const result = await searchTask.execute({ user_id: other_user_id } as any, { page: 1, limit: 10, sort_by: 'asc(task_id)' } as any, [])

            expect(result.search_info.total).toBe(17000)
            expect(result.tasks).toHaveLength(10)
        })

        test('a non-admin sees the tasks they own or that belong to their projects', async () => {
            // other_user has a privilege on project_1 only
            const userRepo: any = { ensureUserCanBeUsed: async () => undefined, isAdmin: async () => false }
            const privilegeRepo: any = { getProjectsByUser: async () => [project_1] }
            const searchTask = new SearchTask(userRepo, taskRepo, new SearchRepositoryImpl(), {} as any, privilegeRepo)

            const own_in_other_project = await newTask(TaskType.Import, project_2, other_user_id)
            const own_cross_project = await newTask(TaskType.Export_Raw, null, other_user_id)
            const others_in_my_project = await newTask(TaskType.Import, project_1, owner_id)
            await newTask(TaskType.Import, project_2, owner_id)
            await newTask(TaskType.Export_Raw, null, owner_id)

            const result = await searchTask.execute({ user_id: other_user_id } as any, { page: 1, limit: 10, sort_by: 'asc(task_id)' } as any, [])

            expect(result.tasks.map(t => t.task_id)).toEqual([own_in_other_project, own_cross_project, others_in_my_project])
            expect(result.search_info.total).toBe(3)
            expect(result.tasks[0]).not.toHaveProperty('task_log_file_path')
        })
    })
})
