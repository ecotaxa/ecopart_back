import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareProjectValidation } from '../interfaces/middleware/project-validation'

import { CreateProjectUseCase } from '../../domain/interfaces/use-cases/project/create-project'
import { DeleteProjectUseCase } from '../../domain/interfaces/use-cases/project/delete-project'
import { UpdateProjectUseCase } from '../../domain/interfaces/use-cases/project/update-project'

import { CustomRequest } from '../../domain/entities/auth'
import { SearchProjectUseCase } from '../../domain/interfaces/use-cases/project/search-project'

export default function ProjectRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareProjectValidation: IMiddlewareProjectValidation,
    createProjectUseCase: CreateProjectUseCase,
    deleteProjectUseCase: DeleteProjectUseCase,
    updateProjectUseCase: UpdateProjectUseCase,
    searchProjectUseCase: SearchProjectUseCase
) {
    const router = express.Router()

    //Pagined and sorted list of all project
    router.get('/', middlewareAuth.auth, middlewareProjectValidation.rulesGetProjects, async (req: Request, res: Response) => {
        try {
            const project = await searchProjectUseCase.execute((req as CustomRequest).token, { ...req.query } as any, []);
            res.status(200).send(project)
        } catch (err) {
            console.log(err)
            if (err.message === "Project is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't get projects"] })
        }
    })

    // Pagined and sorted list of filtered project
    router.post('/searches', middlewareAuth.auth, middlewareProjectValidation.rulesGetProjects, async (req: Request, res: Response) => {
        try {
            const project = await searchProjectUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[]);
            res.status(200).send(project)
        } catch (err) {
            console.log(err)
            if (err.message === "Project is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid sorting statement")) res.status(401).send({ errors: [err.message] })
            else if (err.message.includes("Invalid filter statement ")) res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't search projects"] })
        }
    })

    router.post('/', middlewareAuth.auth, middlewareProjectValidation.rulesProjectRequestCreationtModel, async (req: Request, res: Response) => {
        try {
            const created_project = await createProjectUseCase.execute((req as CustomRequest).token, req.body)
            res.status(201).send(created_project)
        } catch (err) {
            console.log(err)
            if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Can't find created project") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't create project"] })
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
            else if (err.message === "Can't find updated project") res.status(404).send({ errors: [err.message] })
            else if (err.message.includes("Unauthorized or unexisting parameters")) res.status(401).send({ errors: [err.message] })
            else if (err.message === "Please provide at least one valid parameter to update") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't update project"] })
        }
    })

    router.delete('/:project_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteProjectUseCase.execute((req as CustomRequest).token, { ...req.body, project_id: req.params.project_id })
            res.status(200).send({ message: "Project successfully deleted" })
        } catch (err) {
            console.log(err)
            if (err.message === "User is deleted") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Can't find project to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete this project") res.status(403).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Can't delete project"] })
        }
    })

    return router
}