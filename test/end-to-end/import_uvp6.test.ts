// End-to-end test: UVP6 import flow
// Covers samples with images / without images (UVP6 imports are always zipped),
// CTD import, and EcoTaxa import on the TEST ecotaxa-dev instance.
//
// Dataset used:
//   data_storage/ecopart_data_to_import/remote/ftp_plankton/Ecotaxa_Data_to_import/uvp6_endtoend_TEST
//     ecodata/
//       ALR006_20240611_0001_0000_x0001/  -> WITH images (_Images.zip + _Particule.zip)
//       ALR006_20240612_0002_0001_d0001/  -> NO images  (_Particule.zip only)
//     CTDdata/   -> .ctd files for both samples
//
// Cleanup is performed in afterAll so it runs whether the assertions pass or not.

import request from "supertest"
import server from '../../src/server'
import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'
import os from 'os'
import yauzl from 'yauzl'

import { ecotaxaE2eAvailable } from './ecotaxa-availability'

import { MiddlewareAuthCookie } from '../../src/presentation/middleware/auth-cookie'
import { MiddlewareAuthValidation } from '../../src/presentation/middleware/auth-validation'
import { MiddlewareUserValidation } from '../../src/presentation/middleware/user-validation'

import UserRouter from '../../src/presentation/routers/user-router'
import AuthRouter from '../../src/presentation/routers/auth-router'
import ProjectRouter from '../../src/presentation/routers/project-router'
import TaskRouter from '../../src/presentation/routers/tasks-router'
import EcoTaxaInstanceRouter from '../../src/presentation/routers/ecotaxa_instance-router'
import ExportRouter from '../../src/presentation/routers/export-router'
import { MiddlewareProjectValidation } from '../../src/presentation/middleware/project-validation'
import { MiddlewareSampleValidation } from '../../src/presentation/middleware/sample-validation'
import { MiddlewareTaskValidation } from '../../src/presentation/middleware/task-validation'
import { MiddlewareExportValidation } from '../../src/presentation/middleware/export-validation'

import { SearchUsers } from '../../src/domain/use-cases/user/search-users'
import { CreateUser } from '../../src/domain/use-cases/user/create-user'
import { MigrateUsers } from '../../src/domain/use-cases/user/migrate-users'
import { ResendMigrationEmails } from '../../src/domain/use-cases/user/resend-migration-emails'
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
import { ListOrganisations } from '../../src/domain/use-cases/user/list-organisations'
import { CreateProject } from '../../src/domain/use-cases/project/create-project'
import { DeleteProject } from '../../src/domain/use-cases/project/delete-project'
import { UpdateProject } from '../../src/domain/use-cases/project/update-project'
import { SearchProject } from '../../src/domain/use-cases/project/search-projects'
import { GetProject } from '../../src/domain/use-cases/project/get-project'
import { MigrateEcotaxaProject } from '../../src/domain/use-cases/project/migrate-ecotaxa-project'
import { GetSampleQcGraphs } from '../../src/domain/use-cases/sample/get-sample-qc-graphs'
import { SetSampleVisualQc } from '../../src/domain/use-cases/sample/set-sample-visual-qc'
import { PreviewSamplesQcGraphs } from '../../src/domain/use-cases/sample/preview-samples-qc-graphs'
import { BackupProject } from '../../src/domain/use-cases/project/backup-project'
import { ExportBackupedProject } from '../../src/domain/use-cases/project/export-backuped-project'
import { ExportRawData } from '../../src/domain/use-cases/export/export-raw-data'
import { ListImportableSamples } from '../../src/domain/use-cases/sample/list-importable-samples'
import { ImportSamples } from '../../src/domain/use-cases/sample/import-samples'
import { DeleteSample } from '../../src/domain/use-cases/sample/delete-sample'
import { SearchSamples } from '../../src/domain/use-cases/sample/search-samples'
import { ListImportableEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/list-importable-ecotaxa-samples'
import { ImportEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/import-ecotaxa-samples'
import { DeleteEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/delete-ecotaxa-samples'
import { SearchEcoTaxaSamples } from '../../src/domain/use-cases/ecotaxa_sample/search-ecotaxa-samples'
import { ListImportableCTDSamples } from '../../src/domain/use-cases/ctd_sample/list-importable-ctd-samples'
import { ImportCTDSamples } from '../../src/domain/use-cases/ctd_sample/import-ctd-samples'
import { ListImportedCTDSamples } from '../../src/domain/use-cases/ctd_sample/list-imported-ctd-samples'
import { DeleteImportedCTDSamples } from '../../src/domain/use-cases/ctd_sample/delete-imported-ctd-samples'
import { ListShips } from '../../src/domain/use-cases/project/list-ships'
import { DeleteTask } from '../../src/domain/use-cases/task/delete-task'
import { GetAllEcoTaxaInstances } from '../../src/domain/use-cases/ecotaxa_instance/get-all-ecotaxa-instances'
import { CreateEcoTaxaInstance } from '../../src/domain/use-cases/ecotaxa_instance/create-ecotaxa-instance'
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
import { MigrationManager } from '../../src/data/migrations/migration-manager'

sqlite3.verbose()

jest.setTimeout(600000)

const ACCESS_TOKEN_SECRET = "test_access_secret"
const REFRESH_TOKEN_SECRET = "test_refresh_secret"
const VALIDATION_TOKEN_SECRET = "test_validation_secret"
const RESET_PASSWORD_TOKEN_SECRET = "test_reset_password_secret"
const GENERIC_ECOTAXA_ACCOUNT_EMAIL = "generic.ecotaxa.test@test.com"
const NODE_ENV = "DEV"

// UVP6 samples are always zipped (no unzipped vs zipped distinction).
const SAMPLE_WITH_IMAGES = "ALR006_20240611_0001_0000_x0001"
const SAMPLE_NO_IMAGES = "ALR006_20240612_0002_0001_d0001"

const ALL_SAMPLES = [SAMPLE_WITH_IMAGES, SAMPLE_NO_IMAGES]
const SAMPLES_WITH_IMAGES = [SAMPLE_WITH_IMAGES]
const SAMPLES_WITHOUT_IMAGES = [SAMPLE_NO_IMAGES]

const ECOTAXA_INSTANCE_URL = "https://ecotaxa-dev.imev-mer.fr:5003/"
const DATASET_DIR = path.resolve(__dirname, "../../data_storage/ecopart_data_to_import/remote/ftp_plankton/Ecotaxa_Data_to_import/uvp6_endtoend_TEST")
const e2eCheck = ecotaxaE2eAvailable(DATASET_DIR, ECOTAXA_INSTANCE_URL)
if (!e2eCheck.available) {
    console.warn(`[e2e] Skipping UVP6 import suite — ${e2eCheck.reason}`)
}
const describeE2E = e2eCheck.available ? describe : describe.skip

describeE2E("End-to-end: UVP6 import (samples / CTD / EcoTaxa, with and without images)", () => {
    let db: sqlite3.Database
    let tmpDir: string
    let mailerAdapter: NodemailerAdapter
    let sendConfirmationEmailSpy: jest.SpyInstance

    let capturedConfirmationToken: string
    let capturedUserId: number
    let loginCookies: string[]
    let capturedEcotaxaAccountId: number
    let capturedEcotaxaEcotaxaId: number
    let testInstanceId: number
    let capturedProjectId: number
    const testRunId = `${Date.now()}`
    const testProjectTitle = `TEST_import_UVP6_AUTO_${testRunId}`
    const testProjectAcronym = `UVP6E2E_${testRunId}`

    const cookieHeader = () => loginCookies.map((c: string) => c.split(";")[0]).join("; ")

    // List the entry names (files only) contained in a ZIP file on disk.
    function listZipEntries(zipPath: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const entries: string[] = []
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) return reject(err || new Error("Failed to open zip"))
                zipfile.readEntry()
                zipfile.on("entry", (entry) => {
                    if (!/\/$/.test(entry.fileName)) entries.push(entry.fileName)
                    zipfile.readEntry()
                })
                zipfile.on("end", () => resolve(entries))
                zipfile.on("error", reject)
            })
        })
    }

    async function pollTaskUntilDone(taskId: number, intervalMs = 2000, maxMs = 180000): Promise<any> {
        const start = Date.now()
        while (Date.now() - start < maxMs) {
            const res = await request(server)
                .get(`/tasks/${taskId}/`)
                .set("Cookie", cookieHeader())
            if (res.body.task_status === "DONE" || res.body.task_status === "ERROR") {
                if (res.body.task_status === "ERROR") {
                    const logRes = await request(server)
                        .get(`/tasks/${taskId}/log`)
                        .set("Cookie", cookieHeader())
                    console.log("=== Task error ===", JSON.stringify(res.body, null, 2))
                    console.log("=== Task log ===\n", typeof logRes.text === 'string' ? logRes.text : JSON.stringify(logRes.body))
                }
                return res.body
            }
            await new Promise(r => setTimeout(r, intervalMs))
        }
        throw new Error(`Task ${taskId} did not complete within ${maxMs}ms`)
    }

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_e2e_uvp6_"))
        const dbFolder = path.join(tmpDir, "db")

        const projectRoot = path.resolve(__dirname, '..', '..')
        const fsStorage = path.relative(projectRoot, path.join(tmpDir, "fs_storage"))
        const exportDir = path.relative(projectRoot, path.join(tmpDir, "export"))
        const importDir = path.relative(projectRoot, path.join(tmpDir, "import"))

        fs.mkdirSync(dbFolder, { recursive: true })
        fs.mkdirSync(path.join(projectRoot, fsStorage), { recursive: true })
        fs.mkdirSync(path.join(projectRoot, exportDir), { recursive: true })
        fs.mkdirSync(path.join(projectRoot, importDir), { recursive: true })

        db = await new Promise<sqlite3.Database>((resolve, reject) => {
            const database = new sqlite3.Database(path.join(dbFolder, "test_e2e_uvp6.db"), (err) => {
                if (err) reject(err)
                else resolve(database)
            })
        })
        db.get("PRAGMA foreign_keys = ON")

        const bcryptAdapter = new BcryptAdapter()
        const jwtAdapter = new JwtAdapter()
        mailerAdapter = new NodemailerAdapter("http://localhost:0", "test@test.com", NODE_ENV, "julie.imev-mer.fr")
        const countriesAdapter = new CountriesAdapter()

        sendConfirmationEmailSpy = jest.spyOn(mailerAdapter, "send_confirmation_email").mockImplementation(async () => { })

        const transporter = {} as any

        const migrationManager = new MigrationManager(db)
        const migrationsDir = path.resolve(__dirname, '../../src/data/migrations')
        await migrationManager.runAllMigrations(migrationsDir)

        const userDS = new SQLiteUserDataSource(db)
        const privilegeDS = new SQLitePrivilegeDataSource(db)
        const ecotaxaAccountDS = new SQLiteEcotaxaAccountDataSource(db)
        const instrumentModelDS = new SQLiteInstrumentModelDataSource(db)
        const projectDS = new SQLiteProjectDataSource(db)
        const taskDS = new SQLiteTaskDataSource(db)
        const sampleDS = new SQLiteSampleDataSource(db)

        const fsAdapter = new FsAdapter()

        const userRepo = new UserRepositoryImpl(userDS, bcryptAdapter, jwtAdapter, VALIDATION_TOKEN_SECRET, RESET_PASSWORD_TOKEN_SECRET)
        const authRepo = new AuthRepositoryImpl(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET)
        const searchRepo = new SearchRepositoryImpl()
        const privilegeRepo = new PrivilegeRepositoryImpl(privilegeDS)
        const ecotaxaAccountRepo = new EcotaxaAccountRepositoryImpl(ecotaxaAccountDS, GENERIC_ECOTAXA_ACCOUNT_EMAIL, NODE_ENV)
        const instrumentModelRepo = new InstrumentModelRepositoryImpl(instrumentModelDS)
        const relTmpDir = path.relative(projectRoot, tmpDir)
        const projectRepo = new ProjectRepositoryImpl(projectDS, fsStorage, exportDir, relTmpDir, 'data_storage/ecopart_data_to_import/')
        const sampleRepo = new SampleRepositoryImpl(sampleDS, fsStorage)
        const taskRepo = new TaskRepositoryImpl(taskDS, fsAdapter, relTmpDir)

        const userMiddleware = UserRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareUserValidation(countriesAdapter),
            new MiddlewareAuthValidation(),
            new CreateUser(userRepo, transporter, mailerAdapter),
            new MigrateUsers(userRepo, transporter, mailerAdapter),
            new ResendMigrationEmails(userRepo, transporter, mailerAdapter),
            new UpdateUser(userRepo),
            new ValidUser(userRepo),
            new DeleteUser(userRepo, privilegeRepo),
            new LoginEcotaxaAccount(userRepo, ecotaxaAccountRepo),
            new LogoutEcotaxaAccount(userRepo, ecotaxaAccountRepo),
            new SearchUsers(userRepo, searchRepo),
            new SearchEcotaxaAccounts(userRepo, ecotaxaAccountRepo, searchRepo),
            new ListOrganisations(userRepo)
        )

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

        const projectMiddleware = ProjectRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareProjectValidation(),
            new MiddlewareSampleValidation(),
            new CreateProject(userRepo, projectRepo, instrumentModelRepo, privilegeRepo, ecotaxaAccountRepo, fsStorage, 'data_storage/ecopart_data_to_import/'),
            new DeleteProject(userRepo, projectRepo, privilegeRepo, sampleRepo, ecotaxaAccountRepo),
            new UpdateProject(userRepo, projectRepo, instrumentModelRepo, privilegeRepo, ecotaxaAccountRepo, sampleRepo, 'data_storage/ecopart_data_to_import/'),
            new SearchProject(userRepo, projectRepo, searchRepo, instrumentModelRepo, privilegeRepo),
            new GetProject(userRepo, projectRepo, privilegeRepo),
            new BackupProject(userRepo, privilegeRepo, projectRepo, taskRepo, fsStorage),
            new ExportBackupedProject(userRepo, privilegeRepo, projectRepo, taskRepo, fsStorage, exportDir, "http://localhost:0"),
            new ListImportableSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, fsStorage),
            new ImportSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, taskRepo, fsStorage),
            new DeleteSample(userRepo, sampleRepo, privilegeRepo, ecotaxaAccountRepo, projectRepo),
            new SearchSamples(userRepo, sampleRepo, searchRepo, instrumentModelRepo, privilegeRepo),
            new ListImportableEcoTaxaSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, fsStorage),
            new ImportEcoTaxaSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, taskRepo, ecotaxaAccountRepo, fsStorage),
            new DeleteEcoTaxaSamples(userRepo, sampleRepo, privilegeRepo, ecotaxaAccountRepo, projectRepo),
            new SearchEcoTaxaSamples(userRepo, sampleRepo, privilegeRepo, projectRepo, searchRepo, ecotaxaAccountRepo),
            new ListImportableCTDSamples(sampleRepo, userRepo, privilegeRepo, projectRepo),
            new ImportCTDSamples(sampleRepo, userRepo, privilegeRepo, projectRepo, taskRepo),
            new ListImportedCTDSamples(sampleRepo, userRepo, privilegeRepo, projectRepo),
            new DeleteImportedCTDSamples(sampleRepo, userRepo, privilegeRepo, projectRepo),
            new ListShips(projectRepo),
            new MigrateEcotaxaProject(userRepo, projectRepo, sampleRepo, privilegeRepo, ecotaxaAccountRepo),
            new GetSampleQcGraphs(userRepo, sampleRepo, projectRepo, privilegeRepo),
            new SetSampleVisualQc(userRepo, sampleRepo, privilegeRepo),
            new PreviewSamplesQcGraphs(userRepo, sampleRepo, projectRepo, privilegeRepo, fsStorage),
        )

        const taskMiddleware = TaskRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareTaskValidation(),
            new DeleteTask(userRepo, taskRepo, privilegeRepo),
            new GetOneTask(taskRepo, userRepo, privilegeRepo),
            new GetLogFileTask(taskRepo, userRepo, privilegeRepo),
            new StreamZipFile(taskRepo, userRepo, privilegeRepo),
            new SearchTask(userRepo, taskRepo, searchRepo, projectRepo, privilegeRepo)
        )

        const ecotaxaInstanceMiddleware = EcoTaxaInstanceRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new GetAllEcoTaxaInstances(ecotaxaAccountRepo),
            new CreateEcoTaxaInstance(userRepo, ecotaxaAccountRepo)
        )

        const exportMiddleware = ExportRouter(
            new MiddlewareAuthCookie(jwtAdapter, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET),
            new MiddlewareExportValidation(),
            new ExportRawData(userRepo, privilegeRepo, projectRepo, sampleRepo, taskRepo, ecotaxaAccountRepo, instrumentModelRepo, relTmpDir, "http://localhost:0"),
        )

        server.use("/users", userMiddleware)
        server.use("/auth", authMiddleware)
        server.use("/projects", projectMiddleware)
        server.use("/tasks", taskMiddleware)
        server.use("/ecotaxa_instances", ecotaxaInstanceMiddleware)
        server.use("/exports", exportMiddleware)
    })

    afterAll(async () => {
        // Best-effort cleanup: delete the project via the API (cascades to samples,
        // ecotaxa objects and ecotaxa project). Runs whether tests passed or not.
        try {
            if (capturedProjectId && loginCookies) {
                await request(server)
                    .delete(`/projects/${capturedProjectId}/`)
                    .set("Cookie", cookieHeader())
            }
        } catch (e) {
            console.warn("Cleanup: failed to delete project", (e as Error).message)
        }

        if (db) db.close()
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }
        if (sendConfirmationEmailSpy) sendConfirmationEmailSpy.mockRestore()
    })

    // ─── Phase 1: Create User ────────────────────────────────────────────
    test("POST /users/ should create a new user", async () => {
        const response = await request(server)
            .post("/users/")
            .send({
                last_name: "Bancel",
                first_name: "Victoria",
                email: `victoria.bancel+uvp6_${testRunId}@imev-mer.fr`,
                password: "Test1234...",
                organisation: "LOV",
                country: "FR",
                user_planned_usage: "Mon usage"
            })

        expect(response.status).toBe(201)
        expect(sendConfirmationEmailSpy).toHaveBeenCalledTimes(1)

        const callArgs = sendConfirmationEmailSpy.mock.calls[0]
        capturedUserId = callArgs[1].user_id
        capturedConfirmationToken = callArgs[2]
        expect(capturedUserId).toBeDefined()
        expect(capturedConfirmationToken).toBeDefined()
    })

    // ─── Phase 2: Validate account ───────────────────────────────────────
    test("GET /users/:user_id/welcome/:confirmation_token should validate the account", async () => {
        const response = await request(server)
            .get(`/users/${capturedUserId}/welcome/${capturedConfirmationToken}`)
        expect(response.status).toBe(200)
    })

    // ─── Phase 3: Login ──────────────────────────────────────────────────
    test("POST /auth/login should authenticate the user", async () => {
        const response = await request(server)
            .post("/auth/login")
            .send({
                email: `victoria.bancel+uvp6_${testRunId}@imev-mer.fr`,
                password: "Test1234..."
            })

        expect(response.status).toBe(200)
        const cookies = response.headers['set-cookie'] as string[]
        loginCookies = cookies
    })

    // ─── Phase 4: Create test EcoTaxa instance & link account ────────────
    test("POST /users/:user_id/ecotaxa_account should link an ecotaxa account", async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(`UPDATE user SET is_admin = 1 WHERE user_id = ?`, [capturedUserId], (err) => {
                if (err) reject(err)
                else resolve()
            })
        })

        const instanceResponse = await request(server)
            .post("/ecotaxa_instances/")
            .set("Cookie", cookieHeader())
            .send({
                ecotaxa_instance_name: "TEST",
                ecotaxa_instance_description: "TEST instance for development",
                ecotaxa_instance_url: ECOTAXA_INSTANCE_URL
            })

        expect(instanceResponse.status).toBe(201)
        testInstanceId = instanceResponse.body.ecotaxa_instance_id

        const response = await request(server)
            .post(`/users/${capturedUserId}/ecotaxa_account`)
            .set("Cookie", cookieHeader())
            .send({
                ecotaxa_user_login: "ecotaxa.api.user@gmail.com",
                ecotaxa_user_password: "test!",
                ecotaxa_instance_id: testInstanceId
            })

        expect(response.status).toBe(200)
        capturedEcotaxaAccountId = response.body.ecotaxa_account_id
        capturedEcotaxaEcotaxaId = response.body.ecotaxa_account_ecotaxa_id
    })

    // ─── Phase 5: Create UVP6 project ────────────────────────────────────
    test("POST /projects/ should create a UVP6 project", async () => {
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
                `INSERT INTO ecotaxa_account (ecotaxa_account_ecotaxa_id, ecotaxa_account_token, ecotaxa_account_user_name, ecotaxa_account_user_email, ecotaxa_account_expiration_utc_date_time, ecotaxa_account_ecopart_user_id, ecotaxa_account_instance_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [capturedEcotaxaEcotaxaId, realEcotaxaToken, "Generic Test", GENERIC_ECOTAXA_ACCOUNT_EMAIL, futureDate.toISOString(), 2, testInstanceId],
                function (err) {
                    if (err) reject(err)
                    else resolve()
                }
            )
        })

        const response = await request(server)
            .post("/projects/")
            .set("Cookie", cookieHeader())
            .send({
                root_folder_path: "remote/ftp_plankton/Ecotaxa_Data_to_import/uvp6_endtoend_TEST",
                project_title: testProjectTitle,
                project_acronym: testProjectAcronym,
                project_description: "description",
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
                serial_number: "sn000213lp",
                contact: { user_id: capturedUserId },
                managers: [{ user_id: capturedUserId }],
                members: [],
                new_ecotaxa_project: true,
                ecotaxa_instance_id: testInstanceId,
                ecotaxa_account_id: capturedEcotaxaAccountId
            })

        expect(response.status).toBe(201)
        expect(response.body.project_id).toBeDefined()
        expect(response.body.instrument_model).toBe("UVP6LP")
        expect(response.body.ecotaxa_project_id).toBeDefined()

        capturedProjectId = response.body.project_id
    })

    // ─── Phase 6: Import samples (with and without images) ──────────────
    test("POST /projects/:id/samples/import should import 2 samples (with/without images)", async () => {
        const listRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/can_be_imported`)
            .set("Cookie", cookieHeader())

        expect(listRes.status).toBe(200)
        const importableNames = (listRes.body as any[]).map(s => s.sample_name)
        for (const name of ALL_SAMPLES) {
            expect(importableNames).toContain(name)
        }

        // Pre-import QC preview: graphs computed straight from the source folder, before import.
        const previewRes = await request(server)
            .post(`/projects/${capturedProjectId}/samples/qc-graphs-preview`)
            .set("Cookie", cookieHeader())
            .send({ sample_names: ALL_SAMPLES })

        expect(previewRes.status).toBe(200)
        expect(previewRes.body.length).toBe(ALL_SAMPLES.length)
        for (const g of previewRes.body) {
            expect(ALL_SAMPLES).toContain(g.sample_name)
            expect(g.sample_id).toBeNull()
            expect(g.visual_qc_status_label).toBe("NOT_IMPORTED")
            expect(g.image_depth_profile.points.length).toBeGreaterThan(0)
            expect(g.image_filtering).toBeDefined()
        }

        // Import and validate at the same time (verified via the pre-import QC preview above).
        const importRes = await request(server)
            .post(`/projects/${capturedProjectId}/samples/import`)
            .set("Cookie", cookieHeader())
            .send({ samples: ALL_SAMPLES, validated_samples: ALL_SAMPLES, backup_project: false })

        expect(importRes.status).toBe(200)
        expect(importRes.body.success).toBe(true)
        const taskResult = await pollTaskUntilDone(importRes.body.task_import_samples.task_id, 2000, 300000)
        expect(taskResult.task_status).toBe("DONE")

        const samplesRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/?page=1&limit=20`)
            .set("Cookie", cookieHeader())
        expect(samplesRes.status).toBe(200)
        expect(samplesRes.body.samples.length).toBe(ALL_SAMPLES.length)

        // Validated-at-import → every sample comes back VALIDATED (unblocks EcoTaxa import + raw export).
        for (const name of ALL_SAMPLES) {
            const s = samplesRes.body.samples.find((x: any) => x.sample_name === name)
            expect(s).toBeDefined()
            expect(s.visual_qc_status_label).toBe("VALIDATED")
        }

        // Parity: post-import QC graphs must equal the pre-import preview (same raw files, shared
        // builder). Only sample_id + visual_qc_status_label may differ.
        const previewByName = new Map<string, any>((previewRes.body as any[]).map(g => [g.sample_name, g]))
        for (const name of ALL_SAMPLES) {
            const s = samplesRes.body.samples.find((x: any) => x.sample_name === name)
            const graphsRes = await request(server)
                .get(`/projects/${capturedProjectId}/samples/${s.sample_id}/qc-graphs`)
                .set("Cookie", cookieHeader())
            expect(graphsRes.status).toBe(200)
            const { sample_id: _pId, visual_qc_status_label: _pStatus, ...preview } = previewByName.get(name)
            const { sample_id: _gId, visual_qc_status_label: _gStatus, ...post } = graphsRes.body
            expect(post).toEqual(preview)
        }

        // Samples without images: nb_vignettes must be 0
        for (const name of SAMPLES_WITHOUT_IMAGES) {
            const s = samplesRes.body.samples.find((x: any) => x.sample_name === name)
            expect(s).toBeDefined()
            expect(s.nb_vignettes).toBe(0)
        }
        // Samples with images: nb_vignettes > 0
        for (const name of SAMPLES_WITH_IMAGES) {
            const s = samplesRes.body.samples.find((x: any) => x.sample_name === name)
            expect(s).toBeDefined()
            expect(s.nb_vignettes).toBeGreaterThan(0)
        }
    })

    // ─── Phase 7: Import CTD samples ─────────────────────────────────────
    test("POST /projects/:id/ctd_samples/import should import CTD data for both samples", async () => {
        const listRes = await request(server)
            .get(`/projects/${capturedProjectId}/ctd_samples/can_be_imported`)
            .set("Cookie", cookieHeader())

        expect(listRes.status).toBe(200)
        const importableCtd = listRes.body as { sample_name: string; file_extension: string }[]
        for (const name of ALL_SAMPLES) {
            const entry = importableCtd.find(e => e.sample_name === name)
            expect(entry).toBeDefined()
            expect(entry!.file_extension).toBe("ctd")
        }

        const importRes = await request(server)
            .post(`/projects/${capturedProjectId}/ctd_samples/import`)
            .set("Cookie", cookieHeader())
            .send({ samples: ALL_SAMPLES, backup_project: false })

        expect(importRes.status).toBe(200)
        // CTD import returns the TaskResponseModel directly (no task_import_samples wrapper)
        const ctdTaskId = importRes.body.task_id || importRes.body.task_import_samples?.task_id
        expect(ctdTaskId).toBeDefined()
        const taskResult = await pollTaskUntilDone(ctdTaskId, 2000, 180000)
        expect(taskResult.task_status).toBe("DONE")

        const importedRes = await request(server)
            .get(`/projects/${capturedProjectId}/ctd_samples`)
            .set("Cookie", cookieHeader())
        expect(importedRes.status).toBe(200)
        const importedList = importedRes.body as { sample_name: string; ctd_import_utc_date_time: string; file_extension: string }[]
        for (const name of ALL_SAMPLES) {
            const entry = importedList.find(s => s.sample_name === name)
            expect(entry).toBeDefined()
            expect(entry!.file_extension).toBe("ctd")
            expect(entry!.ctd_import_utc_date_time).toMatch(/\d{4}-\d{2}-\d{2}T/)
        }
    })

    // ─── Phase 8: Import samples to EcoTaxa (only ones with images) ─────
    test("POST /projects/:id/ecotaxa_samples/import should import samples with images to EcoTaxa", async () => {
        const listRes = await request(server)
            .get(`/projects/${capturedProjectId}/ecotaxa_samples/can_be_imported`)
            .set("Cookie", cookieHeader())

        expect(listRes.status).toBe(200)
        const importable = (listRes.body as any[]).map(s => s.sample_name)
        // Only samples with images should be importable to EcoTaxa.
        for (const name of SAMPLES_WITH_IMAGES) {
            expect(importable).toContain(name)
        }
        for (const name of SAMPLES_WITHOUT_IMAGES) {
            expect(importable).not.toContain(name)
        }

        for (const sampleName of SAMPLES_WITH_IMAGES) {
            const importRes = await request(server)
                .post(`/projects/${capturedProjectId}/ecotaxa_samples/import`)
                .set("Cookie", cookieHeader())
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
            const taskResult = await pollTaskUntilDone(importRes.body.task_import_samples.task_id, 3000, 300000)
            expect(taskResult.task_status).toBe("DONE")
        }

        const samplesRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/?page=1&limit=20`)
            .set("Cookie", cookieHeader())
        expect(samplesRes.status).toBe(200)
        for (const name of SAMPLES_WITH_IMAGES) {
            const s = samplesRes.body.samples.find((x: any) => x.sample_name === name)
            expect(s).toBeDefined()
            expect(s.ecotaxa_sample_imported).toBeTruthy()
        }
    })

    // ─── Phase 9: Export raw data (metadata + LPM + CTD + EcoTaxa) ───────
    test("POST /exports/raw should export all types for the imported samples into one ZIP", async () => {
        // Resolve the sample ids of the just-imported samples.
        const samplesRes = await request(server)
            .get(`/projects/${capturedProjectId}/samples/?page=1&limit=20`)
            .set("Cookie", cookieHeader())
        expect(samplesRes.status).toBe(200)
        const sample_ids: number[] = samplesRes.body.samples.map((s: any) => s.sample_id)
        expect(sample_ids.length).toBe(ALL_SAMPLES.length)

        // Missing ecotaxa_exclude_not_living while requesting ecotaxa must be rejected.
        const invalidRes = await request(server)
            .post("/exports/raw")
            .set("Cookie", cookieHeader())
            .send({ sample_ids, export_types: ["ecotaxa"] })
        expect(invalidRes.status).toBe(422)

        // Full export: all four types in a single ZIP, living-only EcoTaxa objects.
        const exportRes = await request(server)
            .post("/exports/raw")
            .set("Cookie", cookieHeader())
            .send({
                sample_ids,
                export_types: ["metadata", "lpm", "ctd", "ecotaxa"],
                ecotaxa_exclude_not_living: true,
            })
        expect(exportRes.status).toBe(200)
        const exportTaskId = exportRes.body.task_id
        expect(exportTaskId).toBeDefined()

        const taskResult = await pollTaskUntilDone(exportTaskId, 3000, 360000)
        expect(taskResult.task_status).toBe("DONE")

        // Download the produced ZIP and inspect its structure.
        const downloadRes = await request(server)
            .get(`/tasks/${exportTaskId}/file`)
            .set("Cookie", cookieHeader())
            .buffer(true)
            .parse((res, callback) => {
                const chunks: Buffer[] = []
                res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
                res.on("end", () => callback(null, Buffer.concat(chunks)))
            })
        expect(downloadRes.status).toBe(200)

        const zipPath = path.join(tmpDir, `export_${exportTaskId}.zip`)
        fs.writeFileSync(zipPath, downloadRes.body as Buffer)
        const entries = await listZipEntries(zipPath)

        // Metadata: projects.tsv + samples.tsv + the consumer-facing README at the root
        expect(entries).toContain("README.md")
        expect(entries).toContain("metadata/projects.tsv")
        expect(entries).toContain("metadata/samples.tsv")

        // LPM: UVP6 raw Particule zip per sample (Images zip only for sample with images)
        for (const name of ALL_SAMPLES) {
            expect(entries).toContain(`lpm/${capturedProjectId}/${name}/${name}_Particule.zip`)
        }
        for (const name of SAMPLES_WITH_IMAGES) {
            expect(entries).toContain(`lpm/${capturedProjectId}/${name}/${name}_Images.zip`)
        }

        // CTD: one file per imported sample, as imported (.ctd)
        for (const name of ALL_SAMPLES) {
            expect(entries).toContain(`ctd/${capturedProjectId}/${name}.ctd`)
        }

        // EcoTaxa: one export file for the linked project
        expect(entries.some(e => e.startsWith(`ecotaxa/${capturedProjectId}/`))).toBe(true)
    })
})
