// Integration test for the search/filter stack (use case -> repository -> data source -> sqlite).
//
// It guards the fixes for the "search does not filter" report:
//   - project_title LIKE reduces search_info.total (and is case-insensitive for ASCII)
//   - task_status LIKE searches by LABEL
//   - task_type   LIKE searches by LABEL   (regression: previously matched task_type_id -> 404)
//   - task_owner  LIKE searches the joined "First Last (email)" string
//
// It boots a temporary migrated SQLite DB and the real repositories/use cases, with lightweight
// fakes only for the collaborators that gate authorization (user/privilege), so the filter
// translation itself is exercised end to end.
import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { MigrationManager } from '../../../../src/data/migrations/migration-manager'
import { SQLiteProjectDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-project-data-source'
import { SQLiteTaskDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-task-data-source'
import { ProjectRepositoryImpl } from '../../../../src/domain/repositories/project-repository'
import { TaskRepositoryImpl } from '../../../../src/domain/repositories/task-repository'
import { SearchRepositoryImpl } from '../../../../src/domain/repositories/search-repository'
import { SearchProject } from '../../../../src/domain/use-cases/project/search-projects'
import { SearchTask } from '../../../../src/domain/use-cases/task/search-tasks'

const DBFILE = 'TEST_DB_SEARCH_FILTERING'

// Authorization collaborators: admin bypass so the raw filter behaviour is what we assert.
const userRepo: any = {
    ensureUserCanBeUsed: async () => { },
    isAdmin: async () => true,
}
const privilegeRepo: any = {
    getProjectsByUser: async () => [],
    getPublicPrivileges: async () => ({ members: [], managers: [], contact: {} }),
}
const instrumentModelRepo: any = {}

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<number> {
    return new Promise<number>((resolve, reject) =>
        db.run(sql, params, function (this: sqlite3.RunResult, e) { e ? reject(e) : resolve(this.lastID) }))
}

describe('search filtering (integration)', () => {
    let db: sqlite3.Database
    let searchProject: SearchProject
    let searchTask: SearchTask
    const cur = { user_id: 1 } as any

    beforeAll(async () => {
        db = new sqlite3.Database(DBFILE)
        const mm = new MigrationManager(db)
        await mm.runAllMigrations(path.resolve(__dirname, '../../../../src/data/migrations'))

        const projectDs = new SQLiteProjectDataSource(db)
        const taskDs = new SQLiteTaskDataSource(db)
        const projectRepo = new ProjectRepositoryImpl(projectDs, 'fs', 'exp', 'folder', 'imp')
        const taskRepo = new TaskRepositoryImpl(taskDs, {} as any, 'folder')
        const searchRepo = new SearchRepositoryImpl()
        searchProject = new SearchProject(userRepo, projectRepo, searchRepo, instrumentModelRepo, privilegeRepo)
        searchTask = new SearchTask(userRepo, taskRepo, searchRepo, projectRepo, privilegeRepo)

        // Owner of every seeded task.
        const ownerId = await run(db, `INSERT INTO user (first_name,last_name,email,password_hash,valid_email,is_admin,organisation,country,user_planned_usage)
            VALUES ('Jane','Doe','jane@doe.com','x',1,1,'org','FR','research')`)

        for (const t of ['Alpha survey', 'Beta cruise', 'Alpha deep', 'Gamma']) {
            await projectDs.create({
                root_folder_path: '/r', project_title: t, project_acronym: 'AC',
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

        // task_type ids: EXPORT=1 ... IMPORT=5 ; task_status ids: PENDING=1 ... DONE=5 (migration 000)
        const tasks = [
            { type: 5, status: 5 }, // IMPORT / DONE
            { type: 5, status: 1 }, // IMPORT / PENDING
            { type: 1, status: 5 }, // EXPORT / DONE
            { type: 1, status: 1 }, // EXPORT / PENDING
        ]
        for (const t of tasks) {
            await run(db, `INSERT INTO task (task_type_id, task_status_id, task_owner_id, task_project_id, task_creation_utc_date_time)
                VALUES (?, ?, ?, 1, '2020-01-01T00:00:00Z')`, [t.type, t.status, ownerId])
        }
    })

    afterAll(() => { try { fs.unlinkSync(DBFILE) } catch { /* ignore */ } })

    const opts = (sort_by: string) => ({ page: 1, limit: 100, sort_by }) as any

    describe('projects', () => {
        test('no filter returns all 4 (baseline)', async () => {
            const r = await searchProject.execute(cur, opts('asc(project_id)'), [])
            expect(r.search_info.total).toEqual(4)
        })

        test('project_title LIKE %Alpha% reduces total to 2', async () => {
            const r = await searchProject.execute(cur, opts('asc(project_id)'),
                [{ field: 'project_title', operator: 'LIKE', value: '%Alpha%' }])
            expect(r.search_info.total).toEqual(2)
            expect(r.search_info.total).toBeLessThan(4)
        })

        test('project_title LIKE is case-insensitive for ASCII (%alpha% -> 2)', async () => {
            const r = await searchProject.execute(cur, opts('asc(project_id)'),
                [{ field: 'project_title', operator: 'LIKE', value: '%alpha%' }])
            expect(r.search_info.total).toEqual(2)
        })
    })

    describe('tasks', () => {
        test('no filter returns all 4 (baseline)', async () => {
            const r = await searchTask.execute(cur, opts('asc(task_id)'), [])
            expect(r.search_info.total).toEqual(4)
        })

        test('task_status LIKE %done% searches by label -> 2', async () => {
            const r = await searchTask.execute(cur, opts('asc(task_id)'),
                [{ field: 'task_status', operator: 'LIKE', value: '%done%' }])
            expect(r.search_info.total).toEqual(2)
        })

        test('task_type LIKE %import% searches by label -> 2 (regression)', async () => {
            const r = await searchTask.execute(cur, opts('asc(task_id)'),
                [{ field: 'task_type', operator: 'LIKE', value: '%import%' }])
            expect(r.search_info.total).toEqual(2)
        })

        test('task_owner LIKE matches the joined "First Last (email)" string', async () => {
            const r = await searchTask.execute(cur, opts('asc(task_id)'),
                [{ field: 'task_owner', operator: 'LIKE', value: '%jane%' }])
            expect(r.search_info.total).toEqual(4)
            expect(r.tasks[0].task_owner).toEqual('Jane Doe (jane@doe.com)')
        })

        test('task_owner LIKE with no match -> 0', async () => {
            const r = await searchTask.execute(cur, opts('asc(task_id)'),
                [{ field: 'task_owner', operator: 'LIKE', value: '%nobody%' }])
            expect(r.search_info.total).toEqual(0)
        })
    })
})
