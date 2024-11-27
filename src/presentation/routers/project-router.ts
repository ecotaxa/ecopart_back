import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareProjectValidation } from '../interfaces/middleware/project-validation'

import { CreateProjectUseCase } from '../../domain/interfaces/use-cases/project/create-project'
import { DeleteProjectUseCase } from '../../domain/interfaces/use-cases/project/delete-project'
import { UpdateProjectUseCase } from '../../domain/interfaces/use-cases/project/update-project'
import { BackupProjectUseCase } from '../../domain/interfaces/use-cases/project/backup-project'
// import { ExportBackupProjectUseCase } from '../../domain/interfaces/use-cases/project/export-backup-project'
import { ImportSamplesUseCase } from '../../domain/interfaces/use-cases/sample/import-samples'
import { DeleteSampleUseCase } from '../../domain/interfaces/use-cases/sample/delete-sample'
import { SearchSamplesUseCase } from '../../domain/interfaces/use-cases/sample/search-samples'

import { CustomRequest } from '../../domain/entities/auth'
import { SearchProjectsUseCase } from '../../domain/interfaces/use-cases/project/search-project'
import { ListImportableSamplesUseCase } from '../../domain/interfaces/use-cases/sample/list-importable-samples'
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
    // exportBackupProjectUseCase: ExportBackupProjectUseCase,
    listImportableSamplesUseCase: ListImportableSamplesUseCase,
    importSamplesUseCase: ImportSamplesUseCase,
    deleteSampleUseCase: DeleteSampleUseCase,
    searchSamplesUseCase: SearchSamplesUseCase,
) {
    const router = express.Router()

    // Pagined and sorted list of all project
    router.get('/', middlewareAuth.auth, middlewareProjectValidation.rulesGetProjects, async (req: Request, res: Response) => {
        try {
            const project = await searchProjectUseCase.execute((req as CustomRequest).token, { ...req.query } as any, []);
            res.status(200).send(project)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Instrument model not found") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Cannot find privileges")) res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get projects"] })
        }
    })

    // Pagined and sorted list of filtered project
    router.post('/searches', middlewareAuth.auth, middlewareProjectValidation.rulesGetProjects, async (req: Request, res: Response) => {
        try {
            const project = await searchProjectUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[]);
            res.status(200).send(project)
        } catch (err) {
            console.log(err)
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

    router.post('/', middlewareAuth.auth, middlewareProjectValidation.rulesProjectRequestCreationModel, async (req: Request, res: Response) => {
        try {
            const created_project = await createProjectUseCase.execute((req as CustomRequest).token, req.body)
            res.status(201).send(created_project)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Instrument not found") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes(" cannot be used: ")) res.status(403).send({ errors: [err.message] })
            else if (err.message === "At least one user must be a manager") res.status(404).send({ errors: [err.message] })
            else if (err.message === "A user cannot be both a member and a manager") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot find the created project.") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot create privileges for project") res.status(500).send({ errors: [err.message] })
            else if (err.message.includes("Cannot find created privileges")) res.status(500).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot create project"] })
        }
    })

    router.patch('/:project_id/', middlewareProjectValidation.rulesProjectUpdateModel, middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const updated_project = await updateProjectUseCase.execute((req as CustomRequest).token, { ...req.body, project_id: req.params.project_id })
            res.status(200).send(updated_project)
        } catch (err) {
            console.log(err)
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
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message === "Please provide at least one valid parameter to update") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot update project"] })
        }
    })

    router.delete('/:project_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteProjectUseCase.execute((req as CustomRequest).token, { ...req.body, project_id: req.params.project_id })
            res.status(200).send({ message: "Project successfully deleted" })
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find project to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete this project") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete project"] })
        }
    })

    // L0-b project backup
    router.post('/:project_id/backup', middlewareAuth.auth, middlewareProjectValidation.rulesProjectBackup, async (req: Request, res: Response) => {
        try {
            const task = await backupProjectUseCase.execute((req as CustomRequest).token, req.params.project_id as any, req.body.skip_already_imported);
            res.status(200).send(task)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot backup project"] })
        }
    })

    // // L0-b project backup export
    // router.get('/:project_id/backup/export', middlewareAuth.auth, async (req: Request, res: Response) => {
    //     try {
    //         const task = await exportBackupProjectUseCase.execute((req as CustomRequest).token, req.params.project_id as any);
    //         res.status(200).send(task)
    //     } catch (err) {
    //         console.log(err)
    //         if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
    //         else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
    //         else res.status(500).send({ errors: ["Cannot export project"] })
    //     }
    // })

    /***********************************************SAMPLES***********************************************/

    router.get('/:project_id/samples/can_be_imported', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const tasks = await listImportableSamplesUseCase.execute((req as CustomRequest).token, req.params.project_id as any);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(err)
            // if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            // else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
            // else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
            // else res.status(500).send({ errors: ["Cannot search tasks"] })
            res.status(500).send({ errors: ["Cannot list importable samples"] })
        }
    })

    router.post('/:project_id/samples/import', middlewareAuth.auth,/*middlewareSampleValidation.rulesImport,*/  async (req: Request, res: Response) => {
        try {
            const tasks = await importSamplesUseCase.execute((req as CustomRequest).token, req.params.project_id as any, { ...req.body }.samples);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(err)
            // if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            // else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
            // else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
            // else res.status(500).send({ errors: ["Cannot search tasks"] })
            res.status(500).send({ errors: ["Cannot import samples"] })
        }
    })

    // Pagined and sorted list of all project
    router.get('/:project_id/samples/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const project = await searchSamplesUseCase.execute((req as CustomRequest).token, { ...req.query } as any, [], req.params.project_id as any);
            res.status(200).send(project)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot get samples"] })
        }
    })
    // Pagined and sorted list of filtered samples for the given project
    router.post('/:project_id/samples/searches', middlewareAuth.auth, middlewareSampleValidation.rulesGetSamples, async (req: Request, res: Response) => {
        try {
            const project = await searchSamplesUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[], req.params.project_id as any);
            res.status(200).send(project)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Instrument model not found") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid filter statement ")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search samples"] })
        }
    })

    // Delete a sample
    router.delete('/:project_id/samples/:sample_id', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteSampleUseCase.execute((req as CustomRequest).token, req.params.sample_id as any, req.params.project_id as any);
            res.status(200).send({ message: "Sample successfully deleted" })
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find parent project") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Cannot find sample to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "The given project_id does not match the sample's project_id") res.status(401).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete sample") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot delete sample"] })
        }
    })

    // Update a sample
    // router.patch('/:project_id//samples/:sample_id', middlewareProjectValidation.rulesProjectUpdateModel, middlewareAuth.auth, async (req: Request, res: Response) => {
    //     try {
    //         const updated_project = await updateProjectSampleUseCase.execute((req as CustomRequest).token, { ...req.body, project_id: req.params.project_id })
    //         res.status(200).send(updated_project)
    //     } catch (err) {
    //         console.log(err)
    //         if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
    //         else if (err.message === "Logged user cannot update this property or project") res.status(401).send({ errors: [err.message] })
    //         else if (err.message === "Instrument not found") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Member user cannot be use") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Manager user cannot be use") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Contact user cannot be use") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Contact user must be either in members or managers") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "At least one user must be a manager") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "A user cannot be both a member and a manager") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "To update privilege part you must provide members, managers and contact, if you want to manage privileges more granuraly please use privilege endpoints") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Please provide at least one property to update") res.status(401).send({ errors: [err.message] })
    //         else if (err.message === "Privileges partially created, please check members, managers and contact") res.status(500).send({ errors: [err.message] })
    //         else if (err.message === "Cannot find updated project") res.status(404).send({ errors: [err.message] })
    //         else if (err.message === "Cannot find privileges") res.status(404).send({ errors: [err.message] })
    //         else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
    //         else if (err.message === "Please provide at least one valid parameter to update") res.status(401).send({ errors: [err.message] })
    //         else res.status(500).send({ errors: ["Cannot update project"] })
    //     }
    // })

    return router
}