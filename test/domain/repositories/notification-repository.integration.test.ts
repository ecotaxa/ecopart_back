// Integration test of the notifications (task repository -> notification repository -> sqlite), on a
// migrated in-memory database: the owner of a task is notified when it ends, and each user only
// reads, marks and deletes their own notifications.
import sqlite3 from 'sqlite3'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { MigrationManager } from '../../../src/data/migrations/migration-manager'
import { SQLiteTaskDataSource } from '../../../src/data/data-sources/sqlite/sqlite-task-data-source'
import { SQLiteProjectDataSource } from '../../../src/data/data-sources/sqlite/sqlite-project-data-source'
import { SQLiteNotificationDataSource } from '../../../src/data/data-sources/sqlite/sqlite-notification-data-source'
import { NotificationRepositoryImpl } from '../../../src/domain/repositories/notification-repository'
import { TaskRepositoryImpl } from '../../../src/domain/repositories/task-repository'
import { FsAdapter } from '../../../src/infra/files/fs'
import { TasksStatus, TaskType } from '../../../src/domain/entities/task'
import { NotificationType } from '../../../src/domain/entities/notification'
import { TASK_CANCELLED_MESSAGE } from '../../../src/domain/constants/task'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..')

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<number> {
    return new Promise<number>((resolve, reject) =>
        db.run(sql, params, function (this: sqlite3.RunResult, e) { e ? reject(e) : resolve(this.lastID) }))
}

describe('notifications (integration)', () => {
    let db: sqlite3.Database
    let tmp_dir: string
    let notificationRepo: NotificationRepositoryImpl
    let taskRepo: TaskRepositoryImpl
    let owner_id: number
    let other_user_id: number
    let project_id: number

    // project_id null: a cross-project task (an undefined argument would fall back to the default)
    async function newTask(task_type: TaskType = TaskType.Import, task_project_id: number | null = project_id): Promise<number> {
        return taskRepo.createTask({ task_type, task_status: TasksStatus.Pending, task_owner_id: owner_id, task_project_id: task_project_id ?? undefined, task_params: {} })
    }
    async function notificationsOf(user_id: number) {
        return (await notificationRepo.getNotifications({ user_id, unread_only: false, page: 1, limit: 100 })).items
    }

    beforeEach(async () => {
        db = new sqlite3.Database(':memory:')
        await run(db, 'PRAGMA foreign_keys = ON;')
        await new MigrationManager(db, new Proxy({}, { get: () => () => undefined }) as any)
            .runAllMigrations(path.resolve(PROJECT_ROOT, 'src/data/migrations'))

        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecopart-notifications-'))
        const projectDs = new SQLiteProjectDataSource(db)
        notificationRepo = new NotificationRepositoryImpl(new SQLiteNotificationDataSource(db), projectDs)
        taskRepo = new TaskRepositoryImpl(new SQLiteTaskDataSource(db), new FsAdapter(), path.relative(PROJECT_ROOT, tmp_dir), notificationRepo)

        owner_id = await run(db, `INSERT INTO user (first_name,last_name,email,password_hash,valid_email,is_admin,organisation,country,user_planned_usage)
            VALUES ('Jane','Doe','jane@doe.com','x',1,0,'org','FR','research')`)
        other_user_id = await run(db, `INSERT INTO user (first_name,last_name,email,password_hash,valid_email,is_admin,organisation,country,user_planned_usage)
            VALUES ('John','Roe','john@roe.com','x',1,0,'org','FR','research')`)
        project_id = await projectDs.create({
            root_folder_path: '/r', project_title: 'Alpha', project_acronym: 'AC',
            project_description: 'd', cruise: 'cr', ship: 'sh',
            data_owner_name: 'o', data_owner_email: 'o@e.com',
            operator_name: 'op', operator_email: 'op@e.com',
            chief_scientist_name: 'cs', chief_scientist_email: 'cs@e.com',
            override_depth_offset: undefined, enable_descent_filter: false,
            privacy_duration: 1, visible_duration: 1, public_duration: 1,
            instrument_model: 1, serial_number: 'sn',
            ecotaxa_project_id: undefined, ecotaxa_project_name: undefined, ecotaxa_instance_id: undefined,
        } as any)
    })

    afterEach(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()))
        fs.rmSync(tmp_dir, { recursive: true, force: true })
    })

    test('notifies the owner once when a task is done, naming the project', async () => {
        const task_id = await newTask()
        await taskRepo.startTask({ task_id })
        expect(await notificationsOf(owner_id)).toHaveLength(0)

        await taskRepo.finishTask({ task_id })

        const notifications = await notificationsOf(owner_id)
        expect(notifications).toHaveLength(1)
        expect(notifications[0]).toMatchObject({
            user_id: owner_id,
            notification_type: NotificationType.TaskDone,
            notification_message: `Sample import #${task_id} on project "Alpha" is finished.`,
            task_id,
            project_id,
            is_read: false,
        })
        expect(await notificationsOf(other_user_id)).toHaveLength(0)
    })

    test('notifies a failed task and a cross-project task without a project', async () => {
        const task_id = await newTask(TaskType.Compute_Particle_Stats, null)
        await taskRepo.startTask({ task_id })
        await taskRepo.failedTask(task_id, new Error('boom'))

        const [notification] = await notificationsOf(owner_id)
        expect(notification).toMatchObject({
            notification_type: NotificationType.TaskError,
            notification_message: `Particle statistics computation #${task_id} failed.`,
            project_id: null,
        })
    })

    test('notifies a cancelled task, at its end only', async () => {
        const task_id = await newTask(TaskType.Export_Raw)
        await taskRepo.startTask({ task_id })
        await taskRepo.cancelTask(task_id)
        expect(await notificationsOf(owner_id)).toHaveLength(0)

        await taskRepo.failedTask(task_id, new Error(TASK_CANCELLED_MESSAGE))
        const [notification] = await notificationsOf(owner_id)
        expect(notification.notification_type).toBe(NotificationType.TaskCancelled)
    })

    test('the notification outlives its task', async () => {
        const task_id = await newTask()
        await taskRepo.startTask({ task_id })
        await taskRepo.finishTask({ task_id })
        await taskRepo.deleteTask({ task_id })

        const [notification] = await notificationsOf(owner_id)
        expect(notification.task_id).toBeNull()
    })

    test('a user only marks and deletes their own notifications', async () => {
        for (let i = 0; i < 3; i++) {
            const task_id = await newTask()
            await taskRepo.startTask({ task_id })
            await taskRepo.finishTask({ task_id })
        }
        const [newest, , oldest] = await notificationsOf(owner_id)
        expect(newest.notification_id).toBeGreaterThan(oldest.notification_id)
        expect(await notificationRepo.countUnread(owner_id)).toBe(3)

        // Another user changes nothing
        expect(await notificationRepo.markAllRead(other_user_id)).toBe(0)
        expect(await notificationRepo.deleteNotification(other_user_id, newest.notification_id)).toBe(0)

        await notificationRepo.markRead(owner_id, newest.notification_id)
        expect(await notificationRepo.countUnread(owner_id)).toBe(2)
        const unread = await notificationRepo.getNotifications({ user_id: owner_id, unread_only: true, page: 1, limit: 1 })
        expect(unread.total).toBe(2)
        expect(unread.items).toHaveLength(1)

        expect(await notificationRepo.markAllRead(owner_id)).toBe(2)
        expect(await notificationRepo.countUnread(owner_id)).toBe(0)

        expect(await notificationRepo.deleteNotification(owner_id, oldest.notification_id)).toBe(1)
        expect(await notificationsOf(owner_id)).toHaveLength(2)
    })

    test('a failing notification never fails the task', async () => {
        jest.spyOn(notificationRepo, 'onTaskEnded').mockRejectedValueOnce(new Error('db down'))
        jest.spyOn(console, 'log').mockImplementation(() => undefined)
        const task_id = await newTask()
        await taskRepo.startTask({ task_id })

        await expect(taskRepo.finishTask({ task_id })).resolves.toBeUndefined()
        expect((await taskRepo.getOneTask({ task_id }))?.task_status).toBe(TasksStatus.Done)
    })
})
