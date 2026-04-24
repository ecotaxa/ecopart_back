import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareProjectValidation } from '../interfaces/middleware/project-validation'

import { CreateProjectUseCase } from '../../domain/interfaces/use-cases/project/create-project'
import { DeleteProjectUseCase } from '../../domain/interfaces/use-cases/project/delete-project'
import { UpdateProjectUseCase } from '../../domain/interfaces/use-cases/project/update-project'
import { SearchProjectsUseCase } from '../../domain/interfaces/use-cases/project/search-project'
import { BackupProjectUseCase } from '../../domain/interfaces/use-cases/project/backup-project'
import { ExportBackupedProjectUseCase } from '../../domain/interfaces/use-cases/project/export-backuped-project'
import { ImportSamplesUseCase } from '../../domain/interfaces/use-cases/sample/import-samples'
import { DeleteSampleUseCase } from '../../domain/interfaces/use-cases/sample/delete-sample'
import { SearchSamplesUseCase } from '../../domain/interfaces/use-cases/sample/search-samples'
import { ListImportableSamplesUseCase } from '../../domain/interfaces/use-cases/sample/list-importable-samples'

import { ImportEcoTaxaSamplesUseCase } from '../../domain/interfaces/use-cases/ecotaxa_sample/import-ecotaxa-samples'
import { DeleteEcoTaxaSamplesUseCase } from '../../domain/interfaces/use-cases/ecotaxa_sample/delete-ecotaxa-samples'
import { SearchEcoTaxaSamplesUseCase } from '../../domain/interfaces/use-cases/ecotaxa_sample/search-ecotaxa-samples'
import { ListImportableEcoTaxaSamplesUseCase } from '../../domain/interfaces/use-cases/ecotaxa_sample/list-importable-ecotaxa-samples'
import { ListImportableCTDSamplesUseCase } from '../../domain/interfaces/use-cases/ctd_sample/list-importable-ctd-samples'
import { ImportCTDSamplesUseCase } from '../../domain/interfaces/use-cases/ctd_sample/import-ctd-samples'
import { ListImportedCTDSamplesUseCase } from '../../domain/interfaces/use-cases/ctd_sample/list-imported-ctd-samples'
import { DeleteImportedCTDSamplesUseCase } from '../../domain/interfaces/use-cases/ctd_sample/delete-imported-ctd-samples'
import { ListShipsUseCase } from '../../domain/interfaces/use-cases/project/list-ships'


import { CustomRequest } from '../../domain/entities/auth'
import { IMiddlewareSampleValidation } from '../interfaces/middleware/sample-validation'

export default function ProjectRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareProjectValidation: IMiddlewareProjectValidation,
    middlewareSampleValidation: IMiddlewareSampleValidation,
    createProjectUseCase: CreateProjectUseCase,
    deleteProjectUseCase: DeleteProjectUseCase,
    updateProjectUseCase: UpdateProjectUseCase,
    searchProjectUseCase: SearchProjectsUseCase,
    backupProjectUseCase: BackupProjectUseCase,
    exportBackupProjectUseCase: ExportBackupedProjectUseCase,
    listImportableSamplesUseCase: ListImportableSamplesUseCase,
    importSamplesUseCase: ImportSamplesUseCase,
    deleteSampleUseCase: DeleteSampleUseCase,
    searchSamplesUseCase: SearchSamplesUseCase,
    listImportableEcoTaxaSamplesUseCase: ListImportableEcoTaxaSamplesUseCase,
    importEcoTaxaSamplesUseCase: ImportEcoTaxaSamplesUseCase,
    deleteEcoTaxaSamplesUseCase: DeleteEcoTaxaSamplesUseCase,
    searchEcoTaxaSamplesUseCase: SearchEcoTaxaSamplesUseCase,
    listImportableCTDSamplesUseCase: ListImportableCTDSamplesUseCase,
    importCTDSamplesUseCase: ImportCTDSamplesUseCase,
    listImportedCTDSamplesUseCase: ListImportedCTDSamplesUseCase,
    deleteImportedCTDSamplesUseCase: DeleteImportedCTDSamplesUseCase,
    listShipsUseCase: ListShipsUseCase,
) {
    const router = express.Router()

    /**
     * @openapi
     * /projects/ships:
     *   get:
     *     summary: List all ships
     *     description: Returns a list of all distinct ship names from projects.
     *     tags: [Projects]
     *     responses:
     *       200:
     *         description: List of ship names.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // List of all distinct ships
    router.get('/ships', async (req: Request, res: Response) => {
        try {
            const ships = await listShipsUseCase.execute();
            res.status(200).send(ships)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            res.status(500).send({ errors: ["Cannot get ships"] })
        }
    })

    /**
     * @openapi
     * /projects:
     *   get:
     *     summary: List projects
     *     description: Returns a paginated and sorted list of all projects visible to the authenticated user.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     responses:
     *       200:
     *         description: Paginated list of projects.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ProjectSearchResponse'
     *       401:
     *         description: Unauthorized or invalid parameters.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Instrument model or privileges not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Pagined and sorted list of all project
    router.get('/', middlewareAuth.auth, middlewareProjectValidation.rulesGetProjects, async (req: Request, res: Response) => {
        try {
            const project = await searchProjectUseCase.execute((req as CustomRequest).token, { ...req.query } as any, []);
            res.status(200).send(project)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Instrument model not found") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Cannot find privileges")) res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get projects"] })
        }
    })

    /**
     * @openapi
     * /projects/searches:
     *   post:
     *     summary: Search projects
     *     description: |
     *       Returns a paginated, sorted, and filtered list of projects.
     *
     *       **Filtering** — Send an array of filter objects in the request body. Each filter has `field`, `operator`, and `value`.
     *
     *       Supported operators:
     *       | Operator | Value type | Description |
     *       |----------|------------|-------------|
     *       | `=`      | string, number, boolean | Exact match |
     *       | `<>`     | string, number, boolean | Not equal |
     *       | `>` `>=` `<` `<=` | number | Numeric comparison |
     *       | `IN`     | array | Value is one of the given items |
     *       | `LIKE`   | string | Case-insensitive pattern match (`%` = any chars, `_` = one char) |
     *
     *       Use the string `"null"` as value to match NULL fields (`= "null"` → `IS NULL`, `<> "null"` → `IS NOT NULL`).
     *
     *       **Filterable fields:**
     *       | Field | Type | Note |
     *       |-------|------|------|
     *       | `project_id` | number | |
     *       | `project_title` | string | |
     *       | `project_acronym` | string | |
     *       | `project_description` | string | |
     *       | `project_information` | string | |
     *       | `cruise` | string | |
     *       | `ship` | string | |
     *       | `data_owner_name` | string | |
     *       | `data_owner_email` | string | |
     *       | `operator_name` | string | |
     *       | `operator_email` | string | |
     *       | `chief_scientist_name` | string | |
     *       | `chief_scientist_email` | string | |
     *       | `override_depth_offset` | number | |
     *       | `enable_descent_filter` | boolean | |
     *       | `privacy_duration` | number | |
     *       | `visible_duration` | number | |
     *       | `public_duration` | number | |
     *       | `serial_number` | string | |
     *       | `root_folder_path` | string | |
     *       | `project_creation_date` | string (ISO timestamp) | |
     *       | `instrument_model` | string | Computed — resolved to instrument model IDs |
     *       | `for_managing` | boolean | Computed — restricts to projects where current user has a privilege |
     *       | `contact` | string or number | Computed — resolved to project IDs via privilege system |
     *       | `managers` | string or number | Computed — resolved to project IDs via privilege system |
     *       | `members` | string or number | Computed — resolved to project IDs via privilege system |
     *       | `granted_users` | string or number | Computed — resolved to project IDs via privilege system |
     *
     *       **Pagination** — Use query parameters `page` (default 1) and `limit` (default 10).
     *
     *       **Sorting** — Use the `sort_by` query parameter with the format `asc(field)` or `desc(field)`. Chain multiple sorts with commas, e.g. `asc(project_id),desc(project_title)`.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: array
     *             items:
     *               $ref: '#/components/schemas/FilterSearchOptions'
     *           example:
     *             - field: "project_information"
     *               operator: "LIKE"
     *               value: "tes%"
     *             - field: "instrument_model"
     *               operator: "="
     *               value: "UVP5HD"
     *             - field: "project_id"
     *               operator: "IN"
     *               value: [1, 3, 5, 2, 4]
     *             - field: "for_managing"
     *               operator: "="
     *               value: true
     *     responses:
     *       200:
     *         description: Paginated filtered list of projects.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ProjectSearchResponse'
     *       401:
     *         description: Unauthorized or invalid parameters/filters.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Instrument model or privileges not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Pagined and sorted list of filtered project
    router.post('/searches', middlewareAuth.auth, middlewareProjectValidation.rulesGetProjects, async (req: Request, res: Response) => {
        try {
            const project = await searchProjectUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[]);
            res.status(200).send(project)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Instrument model not found") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid filter statement ")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("contact should be a number")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("member should be a number")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("granted_users should be a number")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("member should be an array of numbers")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("managers should be a number")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("managers should be an array of numbers")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("granted_users should be an array of numbers")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("members should be an array of number or a number")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("managers should be an array of number or a number")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("granted_users should be an array of number or a number")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Cannot find privileges")) res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search projects"] })
        }
    })

    /**
     * @openapi
     * /projects:
     *   post:
     *     summary: Create project
     *     description: Create a new project with instrument, privilege, and optional EcoTaxa configuration.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ProjectRequestCreation'
     *     responses:
     *       201:
     *         description: Project successfully created.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PublicProjectResponse'
     *       401:
     *         description: Unauthorized or EcoTaxa configuration error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Instrument or user not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       422:
     *         description: Validation error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post('/', middlewareAuth.auth, middlewareProjectValidation.rulesProjectRequestCreationModel, async (req: Request, res: Response) => {
        try {
            const created_project = await createProjectUseCase.execute((req as CustomRequest).token, req.body)
            res.status(201).send(created_project)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Instrument not found") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes(" cannot be used: ")) res.status(403).send({ errors: [err.message] })
            else if (err.message === "At least one user must be a manager") res.status(404).send({ errors: [err.message] })
            else if (err.message === "A user cannot be both a member and a manager") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot find the created project.") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot create privileges for project") res.status(500).send({ errors: [err.message] })
            else if (err.message.includes("Cannot find created privileges")) res.status(500).send({ errors: [err.message] })
            else if (err.message.includes("User cannot use the provided ecotaxa account current user id: ")) res.status(401).send({ errors: [err.message] })
            else if (err.message === "Ecotaxa instance not found.") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Ecotaxa instance ID is required for a new Ecotaxa project.") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Ecotaxa instance ID is required for an existing Ecotaxa project.") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Ecotaxa account not found.") res.status(401).send({ errors: [err.message] })
            else if (err.message === "EcoTaxa project not found") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Mismatch: Ecotaxa instance ID does not match the Ecotaxa account's instance ID.") res.status(401).send({ errors: [err.message] })
            else if (err.message === "EcoTaxa account is not manager in the ecotaxa project") res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Instruments do not match")) res.status(500).send({ errors: [err.message] })
            else if (err.message.includes("EcoTaxa HTTP Error")) res.status(500).send({ errors: [err.message] })
            else if (err.message.includes("Ecotaxa generic account not found for instance : ")) res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot create project"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}:
     *   patch:
     *     summary: Update project
     *     description: Update an existing project. Can update project info, privileges, and EcoTaxa settings.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID to update.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ProjectUpdate'
     *     responses:
     *       200:
     *         description: Updated project.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/PublicProjectResponse'
     *       401:
     *         description: Unauthorized or invalid parameters.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User is deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project, instrument, or user not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.patch('/:project_id/', middlewareProjectValidation.rulesProjectUpdateModel, middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const updated_project = await updateProjectUseCase.execute((req as CustomRequest).token, { ...req.body, project_id: req.params.project_id })
            res.status(200).send(updated_project)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot update this property or project") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Instrument not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Member user cannot be use") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Manager user cannot be use") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Contact user cannot be use") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Contact user must be either in members or managers") res.status(404).send({ errors: [err.message] })
            else if (err.message === "At least one user must be a manager") res.status(404).send({ errors: [err.message] })
            else if (err.message === "A user cannot be both a member and a manager") res.status(404).send({ errors: [err.message] })
            else if (err.message === "To update privilege part you must provide members, managers and contact, if you want to manage privileges more granuraly please use privilege endpoints") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Please provide at least one property to update") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Privileges partially created, please check members, managers and contact") res.status(500).send({ errors: [err.message] })
            else if (err.message === "Cannot find updated project") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot find privileges") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Cannot find updated privileges")) res.status(500).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message === "Please provide at least one valid parameter to update") res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("EcoTaxa HTTP Error")) res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot update project"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}:
     *   delete:
     *     summary: Delete project
     *     description: Permanently delete a project and its associated data.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID to delete.
     *     responses:
     *       200:
     *         description: Project successfully deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: Logged user cannot delete this project.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.delete('/:project_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteProjectUseCase.execute((req as CustomRequest).token, { ...req.body, project_id: req.params.project_id })
            res.status(200).send({ message: "Project successfully deleted" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find project to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete this project") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete project"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}/backup:
     *   post:
     *     summary: Backup project
     *     description: Start a project backup task. Reads sample data from the filesystem and stores it in the database.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ProjectBackupRequest'
     *     responses:
     *       200:
     *         description: Backup task created.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TaskResponse'
     *       401:
     *         description: User not authorized for this project or backup already running.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project, task type/status, or folder not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // L0-b project backup
    router.post('/:project_id/backup', middlewareAuth.auth, middlewareProjectValidation.rulesProjectBackup, async (req: Request, res: Response) => {
        try {
            const task = await backupProjectUseCase.execute((req as CustomRequest).token, req.params.project_id as any, req.body.skip_already_imported);
            res.status(200).send(task)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot list importable samples in this project") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find project") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task type not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task status not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot create log file") res.status(500).send({ errors: [err.message] })
            else if (err.message === "Cannot find task") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "An export backup is already running for this project") res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Folder does not exist at path")) res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot backup project"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}/backup/last-date:
     *   get:
     *     summary: Get last backup date
     *     description: Returns the date of the last successful backup for the given project, or null if no backup has been performed yet.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     responses:
     *       200:
     *         description: Last backup date (ISO timestamp) or null.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 last_backup_date:
     *                   type: string
     *                   format: date-time
     *                   nullable: true
     *       401:
     *         description: User not authorized for this project.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Get last backup date for a project
    router.get('/:project_id/backup/last-date', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const last_backup_date = await backupProjectUseCase.getLastBackupDate((req as CustomRequest).token, req.params.project_id as any);
            res.status(200).send({ last_backup_date })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot list importable samples in this project") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find project") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get last backup date"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}/backup/export:
     *   post:
     *     summary: Export project backup
     *     description: Start a backup export task. Exports backed-up project data, optionally to FTP.
     *     tags: [Projects]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ProjectBackupExportRequest'
     *     responses:
     *       200:
     *         description: Export task created.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TaskResponse'
     *       401:
     *         description: User not authorized for this project.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project, backup folder, or task not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // L0-b project backup export
    router.post('/:project_id/backup/export', middlewareAuth.auth, middlewareProjectValidation.rulesProjectBackup, async (req: Request, res: Response) => {
        try {
            const task = await exportBackupProjectUseCase.execute((req as CustomRequest).token, req.params.project_id as any, req.body.out_to_ftp);
            res.status(200).send(task)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot list importable samples in this project") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find project") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task type not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task status not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot create log file") res.status(500).send({ errors: [err.message] })
            else if (err.message === "Cannot find task") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Backup folder does not exist at path")) res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot export backuped project"] })
        }
    })

    /***********************************************SAMPLES PARTICULES***********************************************/

    /**
     * @openapi
     * /projects/{project_id}/samples/can_be_imported:
     *   get:
     *     summary: List importable samples
     *     description: Returns a list of sample files that can be imported for the given project.
     *     tags: [Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     responses:
     *       200:
     *         description: List of importable sample names.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       401:
     *         description: Not authorized for this project.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project or folder not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/:project_id/samples/can_be_imported', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const tasks = await listImportableSamplesUseCase.execute((req as CustomRequest).token, req.params.project_id as any);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot list importable samples in this project") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find project") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Folder does not exist at path")) res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot list importable samples"] })
        }
    })

    const sendErrorResponseSampleImport = (res: Response, err: Error, defaultMessage: string) => {
        const errorMap: { [key: string]: { status: number; message: string } } = {
            "User cannot be used": { status: 403, message: err.message },
            "Logged user cannot list importable samples in this project": { status: 401, message: err.message },
            "Cannot find project": { status: 404, message: err.message },
            "Task type not found": { status: 404, message: err.message },
            "Task status not found": { status: 404, message: err.message },
            "Cannot create log file": { status: 500, message: err.message },
            "Task not found": { status: 404, message: err.message },
            "Task is already in this status": { status: 500, message: err.message },
            "Cannot change status from": { status: 500, message: err.message },
            "Cannot find task": { status: 404, message: err.message },
            "An export backup is already running for this project": { status: 401, message: err.message },
            "Folder does not exist at path": { status: 404, message: err.message },
            "No samples to import": { status: 404, message: err.message },
            "Samples not importable:": { status: 401, message: err.message },
            "Unknown instrument model": { status: 404, message: err.message },
            "Backup aborted": { status: 500, message: err.message },
        };

        for (const key in errorMap) {
            if (err.message.includes(key)) {
                const { status, message } = errorMap[key];
                return { status, errors: [message] };
            }
        }

        // Default error response if no match is found
        return { status: 500, errors: [defaultMessage] };
    };

    /**
     * @openapi
     * /projects/{project_id}/samples/import:
     *   post:
     *     summary: Import samples
     *     description: Import selected samples into the project. Optionally triggers a backup after import.
     *     tags: [Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SampleImportRequest'
     *     responses:
     *       200:
     *         description: Import (and optional backup) completed successfully.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SampleImportResponse'
     *       401:
     *         description: User not authorized.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project or samples not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error or partial failure.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post("/:project_id/samples/import", middlewareAuth.auth, middlewareProjectValidation.rulesProjectBackupFromImport, async (req: Request, res: Response) => {
        let importError, backupError;
        let task_import_samples, task_backup_project;

        try {
            task_import_samples = await importSamplesUseCase.execute(
                (req as CustomRequest).token,
                req.params.project_id as any,
                { ...req.body }.samples
            );

            // Proceed with backup only if import is successful
            if (req.body.backup_project === true) {
                try {
                    task_backup_project = await backupProjectUseCase.execute(
                        (req as CustomRequest).token,
                        req.params.project_id as any,
                        req.body.backup_project_skip_already_imported
                    );
                } catch (err) {
                    console.log(err);
                    backupError = sendErrorResponseSampleImport(res, err, "Cannot backup project");
                }
            }
        } catch (err) {
            if (req.body.backup_project === true) {
                backupError = sendErrorResponseSampleImport(res, err, "Backup aborted");
            }
            importError = sendErrorResponseSampleImport(res, err, "Cannot import samples");
        }

        // Handle different outcomes

        // Case 1: Both failed
        if (importError && backupError) {
            return res.status(500).send({
                success: false,
                errors: {
                    import: importError.errors,
                    backup: backupError.errors,
                },
            });
        }

        // Case 2: Import failed, but backup didn't execute (or was skipped)
        if (importError) {
            return res.status(importError.status).send({
                success: false,
                errors: {
                    import: importError.errors,
                },
            });
        }

        // Case 3: Import succeeded, but backup failed
        if (backupError) {
            return res.status(backupError.status).send({
                success: false,
                task_import_samples,
                errors: {
                    backup: backupError.errors,
                },
            });
        }

        // Case 4: Both succeeded
        return res.status(200).send({
            success: true,
            task_import_samples,
            task_backup_project,
        });
    }
    );

    /**
     * @openapi
     * /projects/{project_id}/ctd_samples/can_be_imported:
     *   get:
     *     summary: List importable CTD samples
     *     description: |
     *       Returns the list of CTD sample names that can be imported for the given project.
     *
     *       Importability checks are based on two mandatory criteria:
     *       1. A particle sample with the same `sample_name` is already imported in EcoPart for this project.
     *       2. The CTD file follows the expected format.
     *
     *       IMPORTANT NOTE on the format of CTD data files to be imported:
     *       - One file per sample/profile
     *       - File location:
     *         - UVP5: `ctd_data_cnv` folder of the project
     *         - UVP6: `ctd_DATA` folder of the project
     *       - Filename: `<profileid>.ctd` (same `profileid` as in `*_header_*.txt`)
     *       - Separator: Tab
     *       - File encoding: Latin1
     *       - Column titles: case-insensitive. You can add custom parameter names, but:
     *         - `pressure [db]` is mandatory for depth profiles
     *         - `time [yyyymmddhhmmssmmm]` is mandatory for time series
     *
     *       Standard column names:
     *       - chloro fluo [mg chl m-3]
     *       - conductivity [ms cm-1]
     *       - cpar [%]
     *       - depth [m]
     *       - fcdom [ppb qse]
     *       - in situ density anomaly [kg m-3]
     *       - nitrate [umol l-1]
     *       - oxygen [umol kg-1]
     *       - oxygen [ml l-1]
     *       - par [umol m-2 s-1]
     *       - potential density anomaly [kg m-3]
     *       - potential temperature [degc]
     *       - practical salinity [psu]
     *       - pressure [db]
     *       - qc flag
     *       - spar [umol m-2 s-1]
     *       - temperature [degc]
     *       - time [yyyymmddhhmmssmmm]
     *     tags: [CTD Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     responses:
     *       200:
     *         description: List of importable CTD sample names.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       401:
     *         description: Not authorized for this project.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project or CTD folder not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/:project_id/ctd_samples/can_be_imported', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const samples = await listImportableCTDSamplesUseCase.execute((req as CustomRequest).token, req.params.project_id as any);
            res.status(200).send(samples);
        } catch (err) {
            console.log(new Date().toISOString(), err);
            if (err.message === 'User cannot be used') res.status(403).send({ errors: [err.message] });
            else if (err.message === 'Logged user cannot list importable CTD samples in this project') res.status(401).send({ errors: [err.message] });
            else if (err.message === 'Cannot find project') res.status(404).send({ errors: [err.message] });
            else if (err.message.includes('Folder does not exist at path')) res.status(404).send({ errors: [err.message] });
            else if (err.message === 'Unknown instrument model') res.status(404).send({ errors: [err.message] });
            else res.status(500).send({ errors: ['Cannot list importable CTD samples'] });
        }
    });

    const sendErrorResponseCTDSampleImport = (err: Error, defaultMessage: string) => {
        const errorMap: { [key: string]: { status: number; message: string } } = {
            'User cannot be used': { status: 403, message: err.message },
            'Logged user cannot import CTD samples in this project': { status: 401, message: err.message },
            'Cannot find project': { status: 404, message: err.message },
            'Task type not found': { status: 404, message: err.message },
            'Task status not found': { status: 404, message: err.message },
            'Cannot create log file': { status: 500, message: err.message },
            'Task not found': { status: 404, message: err.message },
            'Cannot find task': { status: 404, message: err.message },
            'Unknown instrument model': { status: 404, message: err.message },
            'CTD samples not importable:': { status: 401, message: err.message },
            'Folder does not exist at path': { status: 404, message: err.message },
        };

        for (const key in errorMap) {
            if (err.message.includes(key)) {
                const { status, message } = errorMap[key];
                return { status, errors: [message] };
            }
        }

        return { status: 500, errors: [defaultMessage] };
    };

    /**
     * @openapi
     * /projects/{project_id}/ctd_samples/import:
     *   post:
     *     summary: Import CTD samples
     *     description: Imports selected CTD files into the project backup storage.
     *     tags: [CTD Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [samples]
     *             properties:
     *               samples:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: List of sample/profile IDs to import from `<profileid>.ctd` files.
     *     responses:
     *       200:
     *         description: CTD import task created.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TaskResponse'
     *       401:
     *         description: User not authorized or provided non-importable samples.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project, folder, or task metadata not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       422:
     *         description: Validation error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ValidationErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post('/:project_id/ctd_samples/import', middlewareAuth.auth, middlewareProjectValidation.rulesProjectBackupFromImport, async (req: Request, res: Response) => {
        try {
            const task = await importCTDSamplesUseCase.execute(
                (req as CustomRequest).token,
                req.params.project_id as any,
                { ...req.body }.samples
            );
            return res.status(200).send(task);
        } catch (err) {
            const errorResponse = sendErrorResponseCTDSampleImport(err as Error, 'Cannot import CTD samples');
            return res.status(errorResponse.status).send({ errors: errorResponse.errors });
        }
    });

    /**
     * @openapi
     * /projects/{project_id}/ctd_samples:
     *   get:
     *     summary: List imported CTD samples
     *     description: Returns imported CTD samples for a project.
     *     tags: [CTD Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     responses:
     *       200:
     *         description: Imported CTD samples.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SampleSearchResponse'
     *       401:
     *         description: User is not allowed to list imported CTD samples.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/:project_id/ctd_samples', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const result = await listImportedCTDSamplesUseCase.execute(
                (req as CustomRequest).token,
                req.params.project_id as any
            );
            return res.status(200).send(result);
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") return res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot list imported CTD samples in this project") return res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find project") return res.status(404).send({ errors: [err.message] })
            else return res.status(500).send({ errors: ["Cannot list imported CTD samples"] })
        }
    });

    /**
     * @openapi
     * /projects/{project_id}/ctd_samples:
     *   delete:
     *     summary: Delete imported CTD samples
     *     description: Delete one or more imported CTD files from file system storage and clear CTD import metadata in linked samples.
     *     tags: [CTD Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - samples
     *             properties:
     *               samples:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Sample names to delete CTD files for.
     *     responses:
     *       200:
     *         description: CTD samples successfully deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: User is not allowed or sample is not currently CTD-imported.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project or CTD sample not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.delete('/:project_id/ctd_samples', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteImportedCTDSamplesUseCase.execute(
                (req as CustomRequest).token,
                req.params.project_id as any,
                req.body.samples as string[]
            );
            return res.status(200).send({ message: "CTD samples successfully deleted" });
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") return res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete imported CTD samples in this project") return res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find project") return res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot find CTD samples to delete") return res.status(404).send({ errors: [err.message] })
            else if (err.message.startsWith("Some CTD samples to delete were not found:")) return res.status(404).send({ errors: [err.message] })
            else if (err.message.startsWith("Some samples do not have an imported CTD file:")) return res.status(401).send({ errors: [err.message] })
            else return res.status(500).send({ errors: ["Cannot delete CTD samples"] })
        }
    });

    /**
     * @openapi
     * /projects/{project_id}/samples:
     *   get:
     *     summary: List samples
     *     description: Returns a paginated and sorted list of all samples for the given project.
     *     tags: [Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     responses:
     *       200:
     *         description: Paginated list of samples.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SampleSearchResponse'
     *       401:
     *         description: Invalid parameters or unauthorized.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Sample type or visual QC status not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Pagined and sorted list of all samples for the given project
    router.get('/:project_id/samples/', middlewareAuth.auth, middlewareSampleValidation.rulesGetSamples, async (req: Request, res: Response) => {
        try {
            const project = await searchSamplesUseCase.execute((req as CustomRequest).token, { ...req.query } as any, [], req.params.project_id as any);
            res.status(200).send(project)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Missing field, operator, or value in filter")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message === ("Sample type not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message === ("Visual QC status not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized sort_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized order_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters :")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get samples"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}/samples/searches:
     *   post:
     *     summary: Search samples
     *     description: |
     *       Returns a paginated, sorted, and filtered list of samples for the given project.
     *
     *       **Filtering** — Send an array of filter objects in the request body. Each filter has `field`, `operator`, and `value`.
     *
     *       Supported operators:
     *       | Operator | Value type | Description |
     *       |----------|------------|-------------|
     *       | `=`      | string, number, boolean | Exact match |
     *       | `<>`     | string, number, boolean | Not equal |
     *       | `>` `>=` `<` `<=` | number | Numeric comparison |
     *       | `IN`     | array | Value is one of the given items |
     *       | `LIKE`   | string | Case-insensitive pattern match (`%` = any chars, `_` = one char) |
     *
     *       Use the string `"null"` as value to match NULL fields (`= "null"` → `IS NULL`, `<> "null"` → `IS NOT NULL`).
     *
     *       **Filterable fields:**
     *       | Field | Type | Note |
     *       |-------|------|------|
     *       | `sample_id` | number | |
     *       | `sample_name` | string | |
     *       | `comment` | string | |
     *       | `instrument_serial_number` | string | |
     *       | `optional_structure_id` | string or null | |
     *       | `max_pressure` | number | |
     *       | `station_id` | string | |
     *       | `sampling_date` | string (ISO date) | |
     *       | `latitude` | number | |
     *       | `longitude` | number | |
     *       | `wind_direction` | number | |
     *       | `wind_speed` | number | |
     *       | `sea_state` | string | |
     *       | `nebulousness` | number | |
     *       | `bottom_depth` | number | |
     *       | `instrument_operator_email` | string | |
     *       | `filename` | string | |
     *       | `sample_creation_date` | string (ISO timestamp) | |
     *       | `filter_first_image` | string | |
     *       | `filter_last_image` | string | |
     *       | `visual_qc_status_id` | number | |
     *       | `sample_type_id` | number | |
     *       | `sample_type_label` | string | Computed — resolved to `sample_type_id` |
     *       | `visual_qc_status_label` | string | Computed — resolved to `visual_qc_status_id` |
     *
     *       **Pagination** — Use query parameters `page` (default 1) and `limit` (default 10).
     *
     *       **Sorting** — Use the `sort_by` query parameter with the format `asc(field)` or `desc(field)`. Chain multiple sorts with commas, e.g. `desc(sampling_date),asc(sample_id)`.
     *     tags: [Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: array
     *             items:
     *               $ref: '#/components/schemas/FilterSearchOptions'
     *           example:
     *             - field: "sample_name"
     *               operator: "LIKE"
     *               value: "Mooring%"
     *             - field: "instrument_serial_number"
     *               operator: "="
     *               value: "000002LP"
     *             - field: "sample_type_label"
     *               operator: "IN"
     *               value: ["Time", "Depth"]
     *             - field: "visual_qc_status_label"
     *               operator: "="
     *               value: "PENDING"
     *     responses:
     *       200:
     *         description: Paginated filtered list of samples.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SampleSearchResponse'
     *       401:
     *         description: Invalid parameters/filters or unauthorized.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Sample type or visual QC status not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Pagined and sorted list of filtered samples for the given project
    router.post('/:project_id/samples/searches', middlewareAuth.auth, middlewareSampleValidation.rulesGetSamples, async (req: Request, res: Response) => {
        try {
            const samples = await searchSamplesUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[], req.params.project_id as any);
            res.status(200).send(samples)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Missing field, operator, or value in filter")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message === ("Sample type not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message === ("Visual QC status not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized sort_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized order_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters :")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search samples"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}/samples/{sample_id}:
     *   delete:
     *     summary: Delete sample
     *     description: Permanently delete a sample from a project.
     *     tags: [Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *       - name: sample_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The sample ID to delete.
     *     responses:
     *       200:
     *         description: Sample successfully deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: User cannot delete sample or project mismatch.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Sample not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Delete a sample
    router.delete('/:project_id/samples/:sample_id', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteSampleUseCase.execute((req as CustomRequest).token, req.params.sample_id as any, req.params.project_id as any);
            res.status(200).send({ message: "Sample successfully deleted" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find sample to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "The given project_id does not match the sample's project_id") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete sample") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete sample"] })
        }
    })

    /***********************************************ECOTAXA SAMPLES***********************************************/

    /**
     * @openapi
     * /projects/{project_id}/ecotaxa_samples/can_be_imported:
     *   get:
     *     summary: List importable EcoTaxa samples
     *     description: Returns a list of EcoTaxa sample files that can be imported for the given project.
     *     tags: [EcoTaxa Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     responses:
     *       200:
     *         description: List of importable EcoTaxa sample names.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       401:
     *         description: Not authorized for this project.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project or folder not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.get('/:project_id/ecotaxa_samples/can_be_imported', middlewareAuth.auth, async (req: Request, res: Response) => {
        console.log("Received request to list importable EcoTaxa samples for project:", req.params.project_id);
        try {
            const tasks = await listImportableEcoTaxaSamplesUseCase.execute((req as CustomRequest).token, req.params.project_id as any);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot list importable EcoTaxa samples in this project") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Cannot find project") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Folder does not exist at path")) res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot list importable EcoTaxa samples"] })
        }
    })

    const sendErrorResponseEcoTaxaSampleImport = (res: Response, err: Error, defaultMessage: string) => {
        const errorMap: { [key: string]: { status: number; message: string } } = {
            "User cannot be used": { status: 403, message: err.message },
            "Logged user cannot list importable samples in this project": { status: 401, message: err.message },
            "Cannot find project": { status: 404, message: err.message },
            "Task type not found": { status: 404, message: err.message },
            "Task status not found": { status: 404, message: err.message },
            "Cannot create log file": { status: 500, message: err.message },
            "Task not found": { status: 404, message: err.message },
            "Task is already in this status": { status: 500, message: err.message },
            "Cannot change status from": { status: 500, message: err.message },
            "Cannot find task": { status: 404, message: err.message },
            "An export backup is already running for this project": { status: 401, message: err.message },
            "Folder does not exist at path": { status: 404, message: err.message },
            "No samples to import": { status: 404, message: err.message },
            "Samples not importable:": { status: 401, message: err.message },
            "Unknown instrument model": { status: 404, message: err.message },
            "Backup aborted": { status: 500, message: err.message },
        };

        for (const key in errorMap) {
            if (err.message.includes(key)) {
                const { status, message } = errorMap[key];
                return { status, errors: [message] };
            }
        }

        // Default error response if no match is found
        return { status: 500, errors: [defaultMessage] };
    };

    /**
     * @openapi
     * /projects/{project_id}/ecotaxa_samples/import:
     *   post:
     *     summary: Import EcoTaxa samples
     *     description: Import selected EcoTaxa samples into the project. Optionally triggers a backup after import.
     *     tags: [EcoTaxa Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SampleImportRequest'
     *     responses:
     *       200:
     *         description: Import (and optional backup) completed successfully.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SampleImportResponse'
     *       401:
     *         description: User not authorized.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Project or samples not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error or partial failure.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    router.post("/:project_id/ecotaxa_samples/import", middlewareAuth.auth, middlewareProjectValidation.rulesProjectBackupFromImport, async (req: Request, res: Response) => {
        let importError, backupError;
        let task_import_samples, task_backup_project;

        try {
            task_import_samples = await importEcoTaxaSamplesUseCase.execute(
                (req as CustomRequest).token,
                req.params.project_id as any,
                { ...req.body }.samples,
                req.body.ecotaxa_user
            );

            // Proceed with backup only if import is successful
            if (req.body.backup_project === true) {
                try {
                    task_backup_project = await backupProjectUseCase.execute(
                        (req as CustomRequest).token,
                        req.params.project_id as any,
                        req.body.backup_project_skip_already_imported
                    );
                } catch (err) {
                    console.log(err);
                    backupError = sendErrorResponseEcoTaxaSampleImport(res, err, "Cannot backup project");
                }
            }
        } catch (err) {
            if (req.body.backup_project === true) {
                backupError = sendErrorResponseEcoTaxaSampleImport(res, err, "Backup aborted");
            }
            importError = sendErrorResponseEcoTaxaSampleImport(res, err, "Cannot import samples");
        }

        // Handle different outcomes

        // Case 1: Both failed
        if (importError && backupError) {
            return res.status(500).send({
                success: false,
                errors: {
                    import: importError.errors,
                    backup: backupError.errors,
                },
            });
        }

        // Case 2: Import failed, but backup didn't execute (or was skipped)
        if (importError) {
            return res.status(importError.status).send({
                success: false,
                errors: {
                    import: importError.errors,
                },
            });
        }

        // Case 3: Import succeeded, but backup failed
        if (backupError) {
            return res.status(backupError.status).send({
                success: false,
                task_import_samples,
                errors: {
                    backup: backupError.errors,
                },
            });
        }

        // Case 4: Both succeeded
        return res.status(200).send({
            success: true,
            task_import_samples,
            task_backup_project,
        });
    }
    );

    /**
     * @openapi
     * /projects/{project_id}/ecotaxa_samples:
     *   get:
     *     summary: List EcoTaxa samples
     *     description: Returns a paginated and sorted list of all EcoTaxa samples for the given project.
     *     tags: [EcoTaxa Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     responses:
     *       200:
     *         description: Paginated list of EcoTaxa samples.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SampleSearchResponse'
     *       401:
     *         description: Invalid parameters or unauthorized.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Sample type or visual QC status not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Pagined and sorted list of all samples for the given project
    router.get('/:project_id/ecotaxa_samples/', middlewareAuth.auth, middlewareSampleValidation.rulesGetSamples, async (req: Request, res: Response) => {
        try {
            const project = await searchEcoTaxaSamplesUseCase.execute((req as CustomRequest).token, { ...req.query } as any, [], req.params.project_id as any);
            res.status(200).send(project)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Missing field, operator, or value in filter")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message === ("Sample type not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message === ("Visual QC status not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized sort_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized order_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters :")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get samples"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}/ecotaxa_samples/searches:
     *   post:
     *     summary: Search EcoTaxa samples
     *     description: |
     *       Returns a paginated, sorted, and filtered list of EcoTaxa samples for the given project.
     *
     *       **Filtering** — Send an array of filter objects in the request body. Each filter has `field`, `operator`, and `value`.
     *
     *       Supported operators:
     *       | Operator | Value type | Description |
     *       |----------|------------|-------------|
     *       | `=`      | string, number, boolean | Exact match |
     *       | `<>`     | string, number, boolean | Not equal |
     *       | `>` `>=` `<` `<=` | number | Numeric comparison |
     *       | `IN`     | array | Value is one of the given items |
     *       | `LIKE`   | string | Case-insensitive pattern match (`%` = any chars, `_` = one char) |
     *
     *       Use the string `"null"` as value to match NULL fields (`= "null"` → `IS NULL`, `<> "null"` → `IS NOT NULL`).
     *
     *       **Filterable fields:**
     *       | Field | Type | Note |
     *       |-------|------|------|
     *       | `sample_id` | number | |
     *       | `sample_name` | string | |
     *       | `comment` | string | |
     *       | `instrument_serial_number` | string | |
     *       | `optional_structure_id` | string or null | |
     *       | `max_pressure` | number | |
     *       | `station_id` | string | |
     *       | `sampling_date` | string (ISO date) | |
     *       | `latitude` | number | |
     *       | `longitude` | number | |
     *       | `bottom_depth` | number | |
     *       | `instrument_operator_email` | string | |
     *       | `filename` | string | |
     *       | `sample_creation_date` | string (ISO timestamp) | |
     *       | `visual_qc_status_id` | number | |
     *       | `sample_type_id` | number | |
     *       | `ecotaxa_sample_imported` | boolean | |
     *       | `ecotaxa_sample_import_date` | string (ISO timestamp) or null | |
     *       | `ecotaxa_sample_id` | number or null | |
     *       | `sample_type_label` | string | Computed — resolved to `sample_type_id` |
     *       | `visual_qc_status_label` | string | Computed — resolved to `visual_qc_status_id` |
     *
     *       **Pagination** — Use query parameters `page` (default 1) and `limit` (default 10).
     *
     *       **Sorting** — Use the `sort_by` query parameter with the format `asc(field)` or `desc(field)`. Chain multiple sorts with commas, e.g. `desc(sampling_date),asc(sample_id)`.
     *     tags: [EcoTaxa Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: array
     *             items:
     *               $ref: '#/components/schemas/FilterSearchOptions'
     *           example:
     *             - field: "sample_name"
     *               operator: "LIKE"
     *               value: "UVPCRS002%"
     *             - field: "sample_type_label"
     *               operator: "IN"
     *               value: ["Time", "Depth"]
     *     responses:
     *       200:
     *         description: Paginated filtered list of EcoTaxa samples.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SampleSearchResponse'
     *       401:
     *         description: Invalid parameters/filters or unauthorized.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Sample type or visual QC status not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Pagined and sorted list of filtered samples for the given project
    router.post('/:project_id/ecotaxa_samples/searches', middlewareAuth.auth, middlewareSampleValidation.rulesGetSamples, async (req: Request, res: Response) => {
        try {
            const samples = await searchEcoTaxaSamplesUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[], req.params.project_id as any);
            res.status(200).send(samples)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Missing field, operator, or value in filter")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message === ("Sample type not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message === ("Visual QC status not found")) res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized sort_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized order_by:")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters :")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search samples"] })
        }
    })

    /**
     * @openapi
     * /projects/{project_id}/ecotaxa_samples:
     *   delete:
     *     summary: Delete EcoTaxa samples
     *     description: Delete one or more EcoTaxa samples from a project.
     *     tags: [EcoTaxa Samples]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: project_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The project ID.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - samples
     *             properties:
     *               samples:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of sample IDs to delete.
     *     responses:
     *       200:
     *         description: EcoTaxa samples successfully deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       401:
     *         description: User cannot delete sample or project mismatch.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Sample not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       500:
     *         description: Internal server error.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    // Delete a sample
    router.delete('/:project_id/ecotaxa_samples', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteEcoTaxaSamplesUseCase.execute((req as CustomRequest).token, req.params.project_id as any, req.body.samples as string[]);
            res.status(200).send({ message: "Sample successfully deleted from EcoTaxa" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find sample to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "The given project_id does not match the sample's project_id") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete sample") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete sample"] })
        }
    })
    return router
}