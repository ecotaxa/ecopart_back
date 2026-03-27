// End-to-end test: create user, validate account, login, link ecotaxa account

import request from "supertest"
import server from '../../src/server'
import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'
import os from 'os'

import { MiddlewareAuthCookie } from '../../src/presentation/middleware/auth-cookie'
import { MiddlewareAuthValidation } from '../../src/presentation/middleware/auth-validation'
import { MiddlewareUserValidation } from '../../src/presentation/middleware/user-validation'

import UserRouter from '../../src/presentation/routers/user-router'
import AuthRouter from '../../src/presentation/routers/auth-router'
import ProjectRouter from '../../src/presentation/routers/project-router'
import TaskRouter from '../../src/presentation/routers/tasks-router'
import { MiddlewareProjectValidation } from '../../src/presentation/middleware/project-validation'
import { MiddlewareSampleValidation } from '../../src/presentation/middleware/sample-validation'
import { MiddlewareTaskValidation } from '../../src/presentation/middleware/task-validation'

import { SearchUsers } from '../../src/domain/use-cases/user/search-users'
import { CreateUser } from '../../src/domain/use-cases/user/create-user'
import { UpdateUser } from '../../src/domain/use-cases/user/update-user'
import { LoginUser } from '../../src/domain/use-cases/auth/login'
import { RefreshToken } from '../../src/domain/use-cases/auth/refresh-token'
import { ChangePassword } from '../../src/domain/use-cases/auth/change-password'
import { ValidUser } from '../../src/domain/use-cases/user/valid-user'
import { ResetPasswordRequest } from '../../src/domain/use-cases/auth/reset-password-request'
import { ResetPassword } from '../../src/domain/use-cases/auth/reset-password'
import { DeleteUser } from '../../src/domain/use-cases/user/delete-user'
import { LoginEcotaxaAccount } from '../../src/domain/use-cases/ecotaxa_account/login-ecotaxa_account'
import { LogoutEcotaxaAccount } from '../../src/domain/use-cases/ecotaxa_account/logout-ecotaxa_account'
import { SearchEcotaxaAccounts } from '../../src/domain/use-cases/ecotaxa_account/search-ecotaxa_account'
import { CreateProject } from '../../src/domain/use-cases/project/create-project'
import { DeleteProject } from '../../src/domain/use-cases/project/delete-project'
import { UpdateProject } from '../../src/domain/use-cases/project/update-project'
import { SearchProject } from '../../src/domain/use-cases/project/search-projects'
import { BackupProject } from '../../src/domain/use-cases/project/backup-project'
import { ExportBackupedProject } from '../../src/domain/use-cases/project/export-backuped-project'
import { ListImportableSamples } from '../../src/domain/use-cases/sample/list-importable-samples'
import { ImportSamples } from '../../src/domain/use-cases/sample/import-samples'
import { DeleteSample } from '../../src/domain/use-cases/sample/delete-sample'
import { SearchSamples } from '../../src/domain/use-cases/sample/search-samples'
import { ListImportableEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/list-importable-ecotaxa-samples'
import { ImportEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/import-ecotaxa-samples'
import { DeleteEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/delete-ecotaxa-samples'
import { SearchEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/search-ecotaxa-samples'
import { DeleteTask } from '../../src/domain/use-cases/task/delete-task'
import { GetOneTask } from '../../src/domain/use-cases/task/get-one-task'
import { GetLogFileTask } from '../../src/domain/use-cases/task/get-log-file-task'
import { StreamZipFile } from '../../src/domain/use-cases/task/stream-zip-file'
import { SearchTask } from '../../src/domain/use-cases/task/search-tasks'

import { UserRepositoryImpl } from '../../src/domain/repositories/user-repository'
import { AuthRepositoryImpl } from '../../src/domain/repositories/auth-repository'
import { SearchRepositoryImpl } from '../../src/domain/repositories/search-repository'
import { PrivilegeRepositoryImpl } from '../../src/domain/repositories/privilege-repository'
import { EcotaxaAccountRepositoryImpl } from '../../src/domain/repositories/ecotaxa_account-repository'
import { InstrumentModelRepositoryImpl } from '../../src/domain/repositories/instrument_model-repository'
import { ProjectRepositoryImpl } from '../../src/domain/repositories/project-repository'
import { SampleRepositoryImpl } from '../../src/domain/repositories/sample-repository'
import { TaskRepositoryImpl } from '../../src/domain/repositories/task-repository'

import { SQLiteUserDataSource } from '../../src/data/data-sources/sqlite/sqlite-user-data-source'
import { SQLitePrivilegeDataSource } from '../../src/data/data-sources/sqlite/sqlite-privilege-data-source'
import { SQLiteEcotaxaAccountDataSource } from '../../src/data/data-sources/sqlite/sqlite-ecotaxa_account-data-source'
import { SQLiteInstrumentModelDataSource } from '../../src/data/data-sources/sqlite/sqlite-instrument_model-data-source'
import { SQLiteProjectDataSource } from '../../src/data/data-sources/sqlite/sqlite-project-data-source'
import { SQLiteTaskDataSource } from '../../src/data/data-sources/sqlite/sqlite-task-data-source'
import { SQLiteSampleDataSource } from '../../src/data/data-sources/sqlite/sqlite-sample-data-source'

import { BcryptAdapter } from '../../src/infra/cryptography/bcript'
import { JwtAdapter } from '../../src/infra/auth/jsonwebtoken'
import { NodemailerAdapter } from '../../src/infra/mailer/nodemailer'
import { CountriesAdapter } from '../../src/infra/countries/country'
import { FsAdapter } from '../../src/infra/files/fs'

sqlite3.verbose()

// Increase timeout: bcrypt hashing + DB init + real network calls to ecotaxa-dev + ecotaxa import polling (3 samples)
jest.setTimeout(300000)

const ACCESS_TOKEN_SECRET = "test_access_secret"
const REFRESH_TOKEN_SECRET = "test_refresh_secret"
const VALIDATION_TOKEN_SECRET = "test_validation_secret"
const RESET_PASSWORD_TOKEN_SECRET = "test_reset_password_secret"
const GENERIC_ECOTAXA_ACCOUNT_EMAIL = "generic.ecotaxa.test@test.com"
const NODE_ENV = "DEV"

describe("End-to-end: Create user, validate, login, link ecotaxa account", () => {
    let db: sqlite3.Database
    let tmpDir: string
    let mailerAdapter: NodemailerAdapter
    let sendConfirmationEmailSpy: jest.SpyInstance

    // Shared state across sequential tests
    let capturedConfirmationToken: string
    let capturedUserId: number
    let loginCookies: string[]
    let capturedEcotaxaAccountId: number
    let capturedEcotaxaEcotaxaId: number
    let testInstanceId: number
    let capturedProjectId: number
    let capturedSampleNames: string[] = []
    let capturedSampleIds: number[] = []
    const testRunId = `${Date.now()}`
    const testProjectTitle = `TEST_import_UVP6_AUTO_${testRunId}`
    const testProjectAcronym = `UVP6_AUTO_${testRunId}`

    beforeAll(async () => {
        // Create temp directory for DB and storage
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_e2e_"))
        const dbFolder = path.join(tmpDir, "db")

        // SampleRepositoryImpl.base_folder is path.join(__dirname,'..','..','..') = project root.
        // All storage paths passed around are joined with base_folder, so they must be relative to project root.
        const projectRoot = path.resolve(__dirname, '..', '..')
        const fsStorage = path.relative(projectRoot, path.join(tmpDir, "fs_storage"))
        const exportDir = path.relative(projectRoot, path.join(tmpDir, "export"))
        const importDir = path.relative(projectRoot, path.join(tmpDir, "import"))

        fs.mkdirSync(dbFolder, { recursive: true })
        fs.mkdirSync(path.join(projectRoot, fsStorage), { recursive: true })
        fs.mkdirSync(path.join(projectRoot, exportDir), { recursive: true })
        fs.mkdirSync(path.join(projectRoot, importDir), { recursive: true })

        // Open SQLite DB
        db = await new Promise<sqlite3.Database>((resolve, reject) => {
            const database = new sqlite3.Database(path.join(dbFolder, "test_e2e.db"), (err) => {
                if (err) reject(err)
                else resolve(database)
            })
        })
        db.get("PRAGMA foreign_keys = ON")

        // Adapters
        const bcryptAdapter = new BcryptAdapter()
        const jwtAdapter = new JwtAdapter()
        mailerAdapter = new NodemailerAdapter("http://localhost:0", "test@test.com", NODE_ENV)
        const countriesAdapter = new CountriesAdapter()

        // Spy on send_confirmation_email to capture the confirmation token without sending real emails
        sendConfirmationEmailSpy = jest.spyOn(mailerAdapter, "send_confirmation_email").mockImplementation(async () => { })

        // Dummy transporter (will not actually be used since send_confirmation_email is spied)
        const transporter = {} as any

        // Data sources
        const userDS = new SQLiteUserDataSource(db, GENERIC_ECOTAXA_ACCOUNT_EMAIL)
        const privilegeDS = new SQLitePrivilegeDataSource(db)
        const ecotaxaAccountDS = new SQLiteEcotaxaAccountDataSource(db)
        const instrumentModelDS = new SQLiteInstrumentModelDataSource(db)
        const projectDS = new SQLiteProjectDataSource(db)
        const taskDS = new SQLiteTaskDataSource(db)
        const sampleDS = new SQLiteSampleDataSource(db)

        // Wait for async DB table creation to complete
        await new Promise(resolve => setTimeout(resolve, 3000))

        const fsAdapter = new FsAdapter()

        // Repositories
        const userRepo = new UserRepositoryImpl(userDS, bcryptAdapter, jwtAdapter, VALIDATION_TOKEN_SECRET, RESET_PASSWORD_TOKEN_SECRET)
        const authRepo = new AuthRepositoryImpl(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET)
        const searchRepo = new SearchRepositoryImpl()
        const privilegeRepo = new PrivilegeRepositoryImpl(privilegeDS)
        const ecotaxaAccountRepo = new EcotaxaAccountRepositoryImpl(ecotaxaAccountDS, GENERIC_ECOTAXA_ACCOUNT_EMAIL, NODE_ENV)
        const instrumentModelRepo = new InstrumentModelRepositoryImpl(instrumentModelDS)
        const relTmpDir = path.relative(projectRoot, tmpDir)
        const projectRepo = new ProjectRepositoryImpl(projectDS, fsStorage, exportDir, relTmpDir)
        const sampleRepo = new SampleRepositoryImpl(sampleDS, fsStorage)
        const taskRepo = new TaskRepositoryImpl(taskDS, fsAdapter, relTmpDir)

        // Mount user router
        const userMiddleware = UserRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareUserValidation(countriesAdapter),
            new MiddlewareAuthValidation(),
            new CreateUser(userRepo, transporter, mailerAdapter),
            new UpdateUser(userRepo),
            new ValidUser(userRepo),
            new DeleteUser(userRepo, privilegeRepo),
            new LoginEcotaxaAccount(userRepo, ecotaxaAccountRepo),
            new LogoutEcotaxaAccount(userRepo, ecotaxaAccountRepo),
            new SearchUsers(userRepo, searchRepo),
            new SearchEcotaxaAccounts(userRepo, ecotaxaAccountRepo, searchRepo)
        )

        // Mount auth router
        const authMiddleware = AuthRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareAuthValidation(),
            new LoginUser(userRepo, authRepo),
            new RefreshToken(userRepo, authRepo),
            new ChangePassword(userRepo),
            new ResetPasswordRequest(userRepo, transporter, mailerAdapter),
            new ResetPassword(userRepo),
            new SearchUsers(userRepo, searchRepo)
        )

        // Mount project router
        const projectMiddleware = ProjectRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareProjectValidation(),
            new MiddlewareSampleValidation(),
            new CreateProject(userRepo, projectRepo, instrumentModelRepo, privilegeRepo, ecotaxaAccountRepo, fsStorage),
            new DeleteProject(userRepo, projectRepo, privilegeRepo, sampleRepo, ecotaxaAccountRepo),
            new UpdateProject(userRepo, projectRepo, instrumentModelRepo, privilegeRepo, ecotaxaAccountRepo),
            new SearchProject(userRepo, projectRepo, searchRepo, instrumentModelRepo, privilegeRepo),
            new BackupProject(userRepo, privilegeRepo, projectRepo, taskRepo, fsStorage),
            new ExportBackupedProject(userRepo, privilegeRepo, projectRepo, taskRepo, fsStorage, exportDir, "http://localhost:0"),
            new ListImportableSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, fsStorage),
            new ImportSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, taskRepo, fsStorage),
            new DeleteSample(userRepo, sampleRepo, privilegeRepo, ecotaxaAccountRepo, projectRepo),
            new SearchSamples(userRepo, sampleRepo, searchRepo, instrumentModelRepo, privilegeRepo),
            new ListImportableEcoTaxaSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, fsStorage),
            new ImportEcoTaxaSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, taskRepo, ecotaxaAccountRepo, fsStorage),
            new DeleteEcoTaxaSamples(userRepo, sampleRepo, privilegeRepo, ecotaxaAccountRepo, projectRepo),
            new SearchEcoTaxaSamples(userRepo, sampleRepo, searchRepo, instrumentModelRepo, privilegeRepo),
        )

        // Mount task router
        const taskMiddleware = TaskRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareTaskValidation(),
            new DeleteTask(userRepo, taskRepo, privilegeRepo),
            new GetOneTask(taskRepo, userRepo, privilegeRepo),
            new GetLogFileTask(taskRepo, userRepo, privilegeRepo),
            new StreamZipFile(taskRepo, userRepo, privilegeRepo),
            new SearchTask(userRepo, taskRepo, searchRepo, projectRepo, privilegeRepo)
        )

        server.use("/users", userMiddleware)
        server.use("/auth", authMiddleware)
        server.use("/projects", projectMiddleware)
        server.use("/tasks", taskMiddleware)
    })

    afterAll(() => {
        // Close SQLite DB and clean up temp directory
        if (db) {
            db.close()
        }
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
        sendConfirmationEmailSpy.mockRestore()
    })

    // ─── Phase 1: Create User ────────────────────────────────────────────
    test("POST /users/ should create a new user", async () => {
        const response = await request(server)
            .post("/users/")
            .send({
                last_name: "Bancel",
                first_name: "Victoria",
                email: "victoria.bancel+1@imev-mer.fr",
                password: "Test1234...",
                organisation: "LOV",
                country: "FR",
                user_planned_usage: "Mon usage"
            })

        expect(response.status).toBe(201)
        expect(response.body).toStrictEqual({ message: "User sucessfully created." })

        // Verify that send_confirmation_email was called
        expect(sendConfirmationEmailSpy).toHaveBeenCalledTimes(1)

        // Capture the user_id (from the UserResponseModel, 2nd arg) and confirmation_token (3rd arg)
        const callArgs = sendConfirmationEmailSpy.mock.calls[0]
        capturedUserId = callArgs[1].user_id
        capturedConfirmationToken = callArgs[2]

        expect(capturedUserId).toBeDefined()
        expect(capturedConfirmationToken).toBeDefined()
        expect(typeof capturedConfirmationToken).toBe("string")
    })

    // ─── Phase 2: Validate Account ───────────────────────────────────────
    test("GET /users/:user_id/welcome/:confirmation_token should validate the account", async () => {
        const response = await request(server)
            .get(`/users/${capturedUserId}/welcome/${capturedConfirmationToken}`)

        expect(response.status).toBe(200)
        expect(response.body).toStrictEqual({ message: "Account activated, please login" })
    })

    // ─── Phase 3: Login ──────────────────────────────────────────────────
    test("POST /auth/login should authenticate the user", async () => {
        const response = await request(server)
            .post("/auth/login")
            .send({
                email: "victoria.bancel+1@imev-mer.fr",
                password: "Test1234..."
            })

        expect(response.status).toBe(200)
        expect(response.body.jwt).toBeDefined()
        expect(response.body.jwt_refresh).toBeDefined()
        expect(typeof response.body.jwt).toBe("string")
        expect(typeof response.body.jwt_refresh).toBe("string")

        // Verify cookies are set
        expect(response.headers['set-cookie']).toBeDefined()
        const cookies = response.headers['set-cookie'] as string[]
        expect(cookies.some((c: string) => c.startsWith("access_token="))).toBe(true)
        expect(cookies.some((c: string) => c.startsWith("refresh_token="))).toBe(true)

        // Store cookies for later authenticated requests
        loginCookies = cookies
    })

    // ─── Phase 4: Create Test EcoTaxa Instance & Link Account ────────────
    test("POST /users/:user_id/ecotaxa_account should link an ecotaxa account", async () => {
        // Insert the TEST ecotaxa instance directly via SQL
        testInstanceId = await new Promise<number>((resolve, reject) => {
            db.run(
                `INSERT INTO ecotaxa_instance (ecotaxa_instance_name, ecotaxa_instance_description, ecotaxa_instance_url) VALUES (?, ?, ?)`,
                ["TEST", "TEST instance for development", "https://ecotaxa-dev.imev-mer.fr:5003/"],
                function (err) {
                    if (err) reject(err)
                    else resolve(this.lastID)
                }
            )
        })
        expect(testInstanceId).toBeGreaterThan(0)

        // Build cookie header from login cookies
        const cookieHeader = loginCookies.map((c: string) => c.split(";")[0]).join("; ")

        const response = await request(server)
            .post(`/users/${capturedUserId}/ecotaxa_account`)
            .set("Cookie", cookieHeader)
            .send({
                ecotaxa_user_login: "ecotaxa.api.user@gmail.com",
                ecotaxa_user_password: "test!",
                ecotaxa_instance_id: testInstanceId
            })

        expect(response.status).toBe(200)
        expect(response.body.ecotaxa_account_id).toBeDefined()
        expect(response.body.ecotaxa_account_ecotaxa_id).toBeDefined()
        expect(response.body.ecotaxa_user_name).toBeDefined()
        expect(response.body.ecotaxa_expiration_date).toBeDefined()
        expect(response.body.ecotaxa_account_instance_id).toBe(testInstanceId)
        expect(response.body.ecotaxa_account_instance_name).toBe("TEST")

        // Store ecotaxa_account_id for later use (project creation)
        capturedEcotaxaAccountId = response.body.ecotaxa_account_id
        capturedEcotaxaEcotaxaId = response.body.ecotaxa_account_ecotaxa_id
    })

    // ─── Phase 5: Create UVP6 Project ────────────────────────────────────
    test("POST /projects/ should create a UVP6 project", async () => {
        // Insert a generic ecotaxa account for the test instance (required by createEcotaxaProject flow)
        // The generic ecopart user (user_id=2) was auto-created by SQLiteUserDataSource init.
        // We use the same ecotaxa_id as the test user so the "add generic manager" step is a no-op.
        // Use the real ecotaxa token from the user's account so the generic account can make API calls.
        const realEcotaxaToken = await new Promise<string>((resolve, reject) => {
            db.get(
                `SELECT ecotaxa_account_token FROM ecotaxa_account WHERE ecotaxa_account_id = ?`,
                [capturedEcotaxaAccountId],
                (err, row: any) => {
                    if (err) reject(err)
                    else resolve(row.ecotaxa_account_token)
                }
            )
        })
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 30)
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO ecotaxa_account (ecotaxa_account_ecotaxa_id, ecotaxa_account_token, ecotaxa_account_user_name, ecotaxa_account_user_email, ecotaxa_account_expiration_date, ecotaxa_account_ecopart_user_id, ecotaxa_account_instance_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [capturedEcotaxaEcotaxaId, realEcotaxaToken, "Generic Test", GENERIC_ECOTAXA_ACCOUNT_EMAIL, futureDate.toISOString(), 2, testInstanceId],
                function (err) {
                    if (err) reject(err)
                    else resolve()
                }
            )
        })

        const cookieHeader = loginCookies.map((c: string) => c.split(";")[0]).join("; ")

        const response = await request(server)
            .post("/projects/")
            .set("Cookie", cookieHeader)
            .send({
                root_folder_path: "data_storage/ecopart_data_to_import/remote/ftp_plankton/Ecotaxa_Data_to_import/uvp6_sn000241lp_20240404_hope02",
                project_title: testProjectTitle,
                project_acronym: testProjectAcronym,
                project_description: "description",
                project_information: "test",
                cruise: "cruise",
                ship: "boat1,boat2",
                data_owner_name: "Julie coustenoble",
                data_owner_email: "julie.cous@univ-littoral.fr",
                operator_name: "bea caraveo",
                operator_email: "beatrice.caraveo@imev-mer.fr",
                chief_scientist_name: "victoria bancel",
                chief_scientist_email: "victoria.bancel@imev-mer.fr",
                enable_descent_filter: true,
                privacy_duration: 2,
                visible_duration: 24,
                public_duration: 36,
                instrument_model: "UVP6LP",
                serial_number: "myserialnumber",
                contact: { user_id: capturedUserId },
                managers: [{ user_id: capturedUserId }],
                members: [],
                new_ecotaxa_project: true,
                ecotaxa_instance_id: testInstanceId,
                ecotaxa_account_id: capturedEcotaxaAccountId
            })

        expect(response.status).toBe(201)
        expect(response.body.project_id).toBeDefined()
        expect(response.body.project_title).toBe(testProjectTitle)
        expect(response.body.project_acronym).toBe(testProjectAcronym)
        expect(response.body.instrument_model).toBe("UVP6LP")
        expect(response.body.contact).toBeDefined()
        expect(response.body.contact.user_id).toBe(capturedUserId)
        expect(response.body.managers).toBeDefined()
        expect(response.body.managers.length).toBeGreaterThanOrEqual(1)
        expect(response.body.ecotaxa_project_id).toBeDefined()

        capturedProjectId = response.body.project_id
    })

    // ─── Helper: poll task until DONE or ERROR ────────────────────────────
    async function pollTaskUntilDone(taskId: number, cookieHeader: string, intervalMs = 2000, maxMs = 60000): Promise<any> {
        const start = Date.now()
        while (Date.now() - start < maxMs) {
            const res = await request(server)
                .get(`/tasks/${taskId}/`)
                .set("Cookie", cookieHeader)
            if (res.body.task_status === "DONE" || res.body.task_status === "ERROR") {
                return res.body
            }
            await new Promise(r => setTimeout(r, intervalMs))
        }
        throw new Error(`Task ${taskId} did not complete within ${maxMs}ms`)
    }

    // ─── Phase 6: Import 3 Samples in EcoPart ──────────────────────────
    test("POST /projects/:id/samples/import should import 3 samples", async () => {
        const cookieHeader = loginCookies.map((c: string) => c.split(";")[0]).join("; ")

        // First, list importable samples
        const listRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/can_be_imported`)
            .set("Cookie", cookieHeader)

        expect(listRes.status).toBe(200)
        expect(listRes.body.length).toBeGreaterThanOrEqual(3)

        // Pick the first 3 samples to import
        const samplesToImport = listRes.body.slice(0, 3).map((s: any) => s.sample_name)

        // Import 3 samples
        const importRes = await request(server)
            .post(`/projects/${capturedProjectId}/samples/import`)
            .set("Cookie", cookieHeader)
            .send({
                samples: samplesToImport,
                backup_project: false
            })

        expect(importRes.status).toBe(200)
        expect(importRes.body.success).toBe(true)
        expect(importRes.body.task_import_samples).toBeDefined()
        expect(importRes.body.task_import_samples.task_id).toBeDefined()

        // Poll task until done
        const taskResult = await pollTaskUntilDone(importRes.body.task_import_samples.task_id, cookieHeader)
        expect(taskResult.task_status).toBe("DONE")

        // Retrieve the imported samples to capture their IDs
        const samplesRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/?page=1&limit=10`)
            .set("Cookie", cookieHeader)

        expect(samplesRes.status).toBe(200)
        expect(samplesRes.body.samples.length).toBe(3)

        // Store sample names and IDs (ordered by sample_name to match)
        for (const name of samplesToImport) {
            const found = samplesRes.body.samples.find((s: any) => s.sample_name === name)
            expect(found).toBeDefined()
            capturedSampleNames.push(found.sample_name)
            capturedSampleIds.push(found.sample_id)
        }
        expect(capturedSampleNames.length).toBe(3)
        expect(capturedSampleIds.length).toBe(3)
    })

    // ─── Phase 7: Import 3 EcoTaxa Samples (one at a time) ─────────────
    test("POST /projects/:id/ecotaxa_samples/import should import 3 samples to ecotaxa", async () => {
        const cookieHeader = loginCookies.map((c: string) => c.split(";")[0]).join("; ")

        // List importable EcoTaxa samples
        const listRes = await request(server)
            .get(`/projects/${capturedProjectId}/ecotaxa_samples/can_be_imported`)
            .set("Cookie", cookieHeader)

        expect(listRes.status).toBe(200)
        expect(listRes.body.length).toBe(3)

        // Import ecotaxa samples one at a time to avoid batch upload issues
        for (const sampleName of capturedSampleNames) {
            const importRes = await request(server)
                .post(`/projects/${capturedProjectId}/ecotaxa_samples/import`)
                .set("Cookie", cookieHeader)
                .send({
                    samples: [sampleName],
                    ecotaxa_user: {
                        ecotaxa_account_id: capturedEcotaxaAccountId,
                        ecotaxa_account_ecopart_user_id: capturedUserId
                    },
                    backup_project: false
                })

            expect(importRes.status).toBe(200)
            expect(importRes.body.success).toBe(true)
            expect(importRes.body.task_import_samples).toBeDefined()
            expect(importRes.body.task_import_samples.task_id).toBeDefined()

            // Poll task until done (ecotaxa import can take longer)
            const taskResult = await pollTaskUntilDone(importRes.body.task_import_samples.task_id, cookieHeader, 3000, 120000)
            expect(taskResult.task_status).toBe("DONE")
        }
    })

    // ─── Phase 8: Delete EcoTaxa Sample 1 only (particle sample stays) ──
    test("DELETE /projects/:project_id/ecotaxa_samples should delete ecotaxa objects for sample 1", async () => {
        const cookieHeader = loginCookies.map((c: string) => c.split(";")[0]).join("; ")

        const deleteRes = await request(server)
            .delete(`/projects/${capturedProjectId}/ecotaxa_samples`)
            .set("Cookie", cookieHeader)
            .send({
                samples: [capturedSampleNames[0]]
            })

        expect(deleteRes.status).toBe(200)
        expect(deleteRes.body.message).toBe("Sample successfully deleted from EcoTaxa")

        // Verify sample 1 still exists locally but ecotaxa_sample_imported is false
        const samplesRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/?page=1&limit=10`)
            .set("Cookie", cookieHeader)

        expect(samplesRes.status).toBe(200)
        const sample1 = samplesRes.body.samples.find((s: any) => s.sample_name === capturedSampleNames[0])
        expect(sample1).toBeDefined()
        expect(sample1.ecotaxa_sample_imported).toBeFalsy()

        // Verify sample 2 and 3 still have ecotaxa imported
        const sample2 = samplesRes.body.samples.find((s: any) => s.sample_name === capturedSampleNames[1])
        const sample3 = samplesRes.body.samples.find((s: any) => s.sample_name === capturedSampleNames[2])
        expect(sample2.ecotaxa_sample_imported).toBeTruthy()
        expect(sample3.ecotaxa_sample_imported).toBeTruthy()
    })

    // ─── Phase 9: Delete Sample 2 (particle + ecotaxa cleanup) ──────────
    test("DELETE /projects/:project_id/samples/:sample_id should delete sample 2 and its ecotaxa objects", async () => {
        const cookieHeader = loginCookies.map((c: string) => c.split(";")[0]).join("; ")

        const deleteRes = await request(server)
            .delete(`/projects/${capturedProjectId}/samples/${capturedSampleIds[1]}`)
            .set("Cookie", cookieHeader)

        expect(deleteRes.status).toBe(200)
        expect(deleteRes.body.message).toBe("Sample successfully deleted")

        // Verify sample 2 no longer exists
        const samplesRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/?page=1&limit=10`)
            .set("Cookie", cookieHeader)

        expect(samplesRes.status).toBe(200)
        expect(samplesRes.body.samples.length).toBe(2) // only sample 1 and 3 remain
        const sample2 = samplesRes.body.samples.find((s: any) => s.sample_name === capturedSampleNames[1])
        expect(sample2).toBeUndefined()

        // Verify sample 1 and 3 still exist
        const sample1 = samplesRes.body.samples.find((s: any) => s.sample_name === capturedSampleNames[0])
        const sample3 = samplesRes.body.samples.find((s: any) => s.sample_name === capturedSampleNames[2])
        expect(sample1).toBeDefined()
        expect(sample3).toBeDefined()
        expect(sample3.ecotaxa_sample_imported).toBeTruthy() // sample 3 still has ecotaxa data
    })

    // ─── Phase 10: Delete Project (sample 3 still has ecotaxa data) ─────
    test("DELETE /projects/:id should cascade delete remaining samples, ecotaxa objects, and ecotaxa project", async () => {
        const cookieHeader = loginCookies.map((c: string) => c.split(";")[0]).join("; ")

        // Delete the project — should cascade: clean ecotaxa objects, delete samples, delete ecotaxa project
        const deleteProjectRes = await request(server)
            .delete(`/projects/${capturedProjectId}/`)
            .set("Cookie", cookieHeader)

        expect(deleteProjectRes.status).toBe(200)
        expect(deleteProjectRes.body.message).toBe("Project successfully deleted")

        // Verify the project no longer exists
        const getProjectRes = await request(server)
            .get(`/projects/${capturedProjectId}/`)
            .set("Cookie", cookieHeader)

        expect(getProjectRes.status).not.toBe(200)
    })
})

