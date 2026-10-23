// DELETE /tasks/:task_id through the real router, use case, repository and data source, on a
// migrated in-memory database: an unfinished task answers 409 and stays (row, log and archive), a
// finished one is deleted with its folder.
import express from 'express'
import request from 'supertest'
import sqlite3 from 'sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Request, Response, NextFunction } from 'express'
import { MigrationManager } from '../../../src/data/migrations/migration-manager'
import { SQLiteTaskDataSource } from '../../../src/data/data-sources/sqlite/sqlite-task-data-source'
import { TaskRepositoryImpl } from '../../../src/domain/repositories/task-repository'
import { DeleteTask } from '../../../src/domain/use-cases/task/delete-task'
import { FsAdapter } from '../../../src/infra/files/fs'
import { TasksStatus, TaskType } from '../../../src/domain/entities/task'
import { CustomRequest, DecodedToken } from '../../../src/domain/entities/auth'
import { MiddlewareAuth } from '../../../src/presentation/interfaces/middleware/auth'
import TaskRouter from '../../../src/presentation/routers/tasks-router'
import { MockUserRepository } from '../../mocks/user-mock'
import { MockPrivilegeRepository } from '../../mocks/privilege-mock'
import { MockGetOneTaskUseCase, MockGetLogFileTask, MockStreamZipFileUseCase, MockSearchTasksUseCase, MockCancelTaskUseCase } from '../../mocks/task-mock'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<number> {
    return new Promise<number>((resolve, reject) =>
        db.run(sql, params, function (this: sqlite3.RunResult, e) { e ? reject(e) : resolve(this.lastID) }))
}

describe('DELETE /tasks/:task_id (integration)', () => {
    let db: sqlite3.Database
    let tmp_dir: string
    let taskDs: SQLiteTaskDataSource
    let taskRepo: TaskRepositoryImpl
    let app: express.Express
    let admin_id: number

    // Brings a new task to the given status through the same calls the workers make
    async function taskWithStatus(status: TasksStatus): Promise<number> {
        const task_id = await taskRepo.createTask({ task_type: TaskType.Import, task_status: TasksStatus.Pending, task_owner_id: admin_id, task_params: {} })
        if (status === TasksStatus.Running || status === TasksStatus.Cancelling || status === TasksStatus.Done) await taskRepo.startTask({ task_id })
        if (status === TasksStatus.Cancelling || status === TasksStatus.Cancelled) await taskRepo.cancelTask(task_id)
        if (status === TasksStatus.Done) await taskRepo.finishTask({ task_id })
        if (status === TasksStatus.Error) await taskRepo.failedTask(task_id, new Error('boom'))
        expect((await taskDs.getOne({ task_id }))?.task_status).toBe(status)
        return task_id
    }

    // The task folder, with its log and an archive written next to it as an export does
    async function taskFiles(task_id: number): Promise<{ folder: string, log: string, archive: string }> {
        const log = (await taskDs.getOne({ task_id }))!.task_log_file_path as string
        const folder = path.dirname(log)
        const archive = path.join(folder, `ecopart_export_raw_${task_id}.zip`)
        fs.writeFileSync(archive, 'zip')
        expect(folder).toBe(path.join(tmp_dir, 'tasks', `${task_id}`))
        expect(fs.existsSync(log)).toBe(true)
        return { folder, log, archive }
    }

    beforeEach(async () => {
        db = new sqlite3.Database(':memory:')
        await run(db, 'PRAGMA foreign_keys = ON;')
        await new MigrationManager(db, new Proxy({}, { get: () => () => undefined }) as any)
            .runAllMigrations(path.resolve(PROJECT_ROOT, 'src/data/migrations'))

        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecopart-task-delete-'))
        taskDs = new SQLiteTaskDataSource(db)
        taskRepo = new TaskRepositoryImpl(taskDs, new FsAdapter(), path.relative(PROJECT_ROOT, tmp_dir))

        admin_id = await run(db, `INSERT INTO user (first_name,last_name,email,password_hash,valid_email,is_admin,organisation,country,user_planned_usage)
            VALUES ('Ada','Admin','ada@admin.com','x',1,1,'org','FR','research')`)

        const userRepo = new MockUserRepository()
        jest.spyOn(userRepo, 'ensureUserCanBeUsed').mockResolvedValue()
        jest.spyOn(userRepo, 'isAdmin').mockResolvedValue(true)

        const auth: MiddlewareAuth = {
            auth: (req: Request, _: Response, next: NextFunction) => { (req as CustomRequest).token = { user_id: admin_id } as DecodedToken; next() },
            auth_optional: (_req: Request, _: Response, next: NextFunction) => next(),
            auth_refresh: () => { throw new Error('Method not implemented for auth_refresh') },
        }
        app = express()
        app.use(express.json())
        app.use('/tasks', TaskRouter(auth, { rulesGetTasks: [] },
            new DeleteTask(userRepo, taskRepo, new MockPrivilegeRepository()),
            new MockGetOneTaskUseCase(), new MockGetLogFileTask(), new MockStreamZipFileUseCase(), new MockSearchTasksUseCase(), new MockCancelTaskUseCase()))
    })

    afterEach(async () => {
        jest.restoreAllMocks()
        await new Promise<void>((resolve) => db.close(() => resolve()))
        fs.rmSync(tmp_dir, { recursive: true, force: true })
    })

    test.each([TasksStatus.Pending, TasksStatus.Running, TasksStatus.Cancelling])('a %s task answers 409 and is not deleted', async (status) => {
        const task_id = await taskWithStatus(status)
        const { log, archive } = await taskFiles(task_id)

        const response = await request(app).delete(`/tasks/${task_id}`)

        expect(response.status).toBe(409)
        expect(response.body).toStrictEqual({ errors: [`Task ${task_id} is still ${status}: cancel it before deleting it.`] })
        expect((await taskDs.getOne({ task_id }))?.task_status).toBe(status)
        expect(fs.existsSync(log)).toBe(true)
        expect(fs.existsSync(archive)).toBe(true)
    })

    test.each([TasksStatus.Done, TasksStatus.Error, TasksStatus.Cancelled])('a %s task is deleted with its folder', async (status) => {
        const task_id = await taskWithStatus(status)
        const { folder } = await taskFiles(task_id)

        const response = await request(app).delete(`/tasks/${task_id}`)

        expect(response.status).toBe(200)
        expect(response.body).toStrictEqual({ message: `Task ${task_id} successfully deleted` })
        expect(await taskDs.getOne({ task_id })).toBeNull()
        expect(fs.existsSync(folder)).toBe(false)
    })
})
