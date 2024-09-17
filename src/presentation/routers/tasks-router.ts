import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
// import { IMiddlewareTaskValidation } from '../interfaces/middleware/task-validation'

import { DeleteTaskUseCase } from '../../domain/interfaces/use-cases/task/delete-task'
import { SearchTasksUseCase } from '../../domain/interfaces/use-cases/task/search-task'
import { GetOneTaskUseCase } from '../../domain/interfaces/use-cases/task/get-one-task'
import { GetLogFileTask } from '../../domain/use-cases/task/get-log-file-task'

import { CustomRequest } from '../../domain/entities/auth'

export default function TaskRouter(
    middlewareAuth: MiddlewareAuth,
    //middlewareTaskValidation: IMiddlewareTaskValidation,
    deleteTaskUseCase: DeleteTaskUseCase,
    getOneTaskUseCase: GetOneTaskUseCase,
    getLogFileTask: GetLogFileTask,
    searchTaskUseCase: SearchTasksUseCase
) {
    const router = express.Router()
    // TODO Manage errors
    // Pagined and sorted list of all task
    router.get('/', middlewareAuth.auth, /*middlewareTaskValidation.rulesGetTasks,*/ async (req: Request, res: Response) => {
        try {
            const tasks = await searchTaskUseCase.execute((req as CustomRequest).token, { ...req.query } as any, []);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search tasks"] })
        }
    })

    // Pagined and sorted list of filtered task
    router.post('/searches', middlewareAuth.auth,/*middlewareTaskValidation.rulesGetTasks,*/  async (req: Request, res: Response) => {
        try {
            const tasks = await searchTaskUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[]);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search tasks"] })
        }
    })

    // Get one task
    router.get('/:task_id/', middlewareAuth.auth,/*middlewareTaskValidation.rulesGetTasks,*/  async (req: Request, res: Response) => {
        try {
            const task = await getOneTaskUseCase.execute((req as CustomRequest).token, { ...req.body, task_id: req.params.task_id })
            res.status(200).send(task)
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find task") res.status(404).send({ errors: [err.message] })
            else if (err.message === "User does not have the necessary permissions to access this task.") res.status(403).send({ errors: ["Cannot get task"] })
            else res.status(500).send({ errors: ["Cannot get task"] })
        }
    })

    // For admin only
    router.delete('/:task_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteTaskUseCase.execute((req as CustomRequest).token, { ...req.body, task_id: req.params.task_id })
            res.status(200).send({ message: "Task " + req.params.task_id + " successfully deleted" })
        } catch (err) {
            console.log(err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find task to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete this task") res.status(403).send({ errors: ["Cannot delete task"] })
            else res.status(500).send({ errors: ["Cannot delete task"] })
        }
    })

    // Fetch log for admin nof task owner of project member/managers
    router.get('/:task_id/log', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const taskId = parseInt(req.params.task_id);
            const logs = await getLogFileTask.execute((req as CustomRequest).token, taskId);
            res.status(200).send(logs);
        } catch (err) {
            console.log(err);
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find task") res.status(404).send({ errors: [err.message] });
            else if (err.message === "User does not have the necessary permissions to access this task.") res.status(403).send({ errors: ["Cannot get task log"] });
            else res.status(500).send({ errors: ["Cannot get task log"] });
        }
    });

    return router
}