import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareTaskValidation } from '../interfaces/middleware/task-validation'

import { DeleteTaskUseCase } from '../../domain/interfaces/use-cases/task/delete-task'
import { SearchTasksUseCase } from '../../domain/interfaces/use-cases/task/search-task'
import { GetOneTaskUseCase } from '../../domain/interfaces/use-cases/task/get-one-task'
import { GetLogFileTaskUseCase } from '../../domain/interfaces/use-cases/task/get-log-file-task'
import { StreamZipFileUseCase } from '../../domain/interfaces/use-cases/task/stream-zip-file'

import { CustomRequest } from '../../domain/entities/auth'

export default function TaskRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareTaskValidation: IMiddlewareTaskValidation,
    deleteTaskUseCase: DeleteTaskUseCase,
    getOneTaskUseCase: GetOneTaskUseCase,
    getLogFileTaskUseCase: GetLogFileTaskUseCase,
    streamZipFileUseCase: StreamZipFileUseCase,
    searchTaskUseCase: SearchTasksUseCase
) {
    const router = express.Router()
    /**
     * @openapi
     * /tasks:
     *   get:
     *     summary: List tasks
     *     description: Returns a paginated and sorted list of all tasks visible to the authenticated user.
     *     tags: [Tasks]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - $ref: '#/components/parameters/PageParam'
     *       - $ref: '#/components/parameters/LimitParam'
     *       - $ref: '#/components/parameters/SortByParam'
     *     responses:
     *       200:
     *         description: Paginated list of tasks.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TaskSearchResponse'
     *       403:
     *         description: User cannot be used.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Task type or status label not found.
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
    // TODO Manage errors
    // Pagined and sorted list of all task
    router.get('/', middlewareAuth.auth, middlewareTaskValidation.rulesGetTasks, async (req: Request, res: Response) => {
        try {
            const tasks = await searchTaskUseCase.execute((req as CustomRequest).token, { ...req.query } as any, []);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search tasks"] })
        }
    })

    /**
     * @openapi
     * /tasks/searches:
     *   post:
     *     summary: Search tasks
     *     description: |
     *       Returns a paginated, sorted, and filtered list of tasks.
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
     *       | `task_id` | number | |
     *       | `task_type_id` | number | |
     *       | `task_status_id` | number | |
     *       | `task_owner_id` | number | |
     *       | `task_project_id` | number or null | |
     *       | `task_progress_pct` | number | |
     *       | `task_progress_msg` | string | |
     *       | `task_step` | number | |
     *       | `task_creation_date` | string (ISO timestamp) | |
     *       | `task_start_date` | string (ISO timestamp) or null | |
     *       | `task_end_date` | string (ISO timestamp) or null | |
     *       | `task_type` | string | Computed — resolved to `task_type_id` |
     *       | `task_status` | string | Computed — resolved to `task_status_id` |
     *       | `for_managing` | boolean | Computed — restricts to tasks owned by or related to current user |
     *
     *       **Pagination** — Use query parameters `page` (default 1) and `limit` (default 10).
     *
     *       **Sorting** — Use the `sort_by` query parameter with the format `asc(field)` or `desc(field)`. Chain multiple sorts with commas, e.g. `desc(task_id),asc(task_status_id)`.
     *     tags: [Tasks]
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
     *             - field: "task_id"
     *               operator: "="
     *               value: 39
     *     responses:
     *       200:
     *         description: Paginated filtered list of tasks.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TaskSearchResponse'
     *       401:
     *         description: Invalid filter value.
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
     *         description: Task type or status label not found.
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
    // Pagined and sorted list of filtered task
    router.post('/searches', middlewareAuth.auth, middlewareTaskValidation.rulesGetTasks, async (req: Request, res: Response) => {
        try {
            const tasks = await searchTaskUseCase.execute((req as CustomRequest).token, { ...req.query } as any, req.body as any[]);
            res.status(200).send(tasks)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Task type label not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task status label not found") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Task managing filter value is not valid") res.status(401).send({ errors: [err.message] })
            else res.status(500).send({ errors: ["Cannot search tasks"] })
        }
    })

    /**
     * @openapi
     * /tasks/{task_id}:
     *   get:
     *     summary: Get one task
     *     description: Returns detailed information for a specific task.
     *     tags: [Tasks]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: task_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The task ID.
     *     responses:
     *       200:
     *         description: Task details.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/TaskResponse'
     *       403:
     *         description: User cannot be used or insufficient permissions.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Task not found.
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
    // Get one task
    router.get('/:task_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const task = await getOneTaskUseCase.execute((req as CustomRequest).token, req.params.task_id as any);
            res.status(200).send(task)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find task") res.status(404).send({ errors: [err.message] })
            else if (err.message === "User does not have the necessary permissions to access this task.") res.status(403).send({ errors: ["Cannot get task"] })
            else res.status(500).send({ errors: ["Cannot get task"] })
        }
    })

    /**
     * @openapi
     * /tasks/{task_id}:
     *   delete:
     *     summary: Delete task
     *     description: Delete a task (admin only).
     *     tags: [Tasks]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: task_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The task ID to delete.
     *     responses:
     *       200:
     *         description: Task successfully deleted.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/MessageResponse'
     *       403:
     *         description: User cannot be used or cannot delete this task.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Task not found.
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
    // For admin only
    router.delete('/:task_id/', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            await deleteTaskUseCase.execute((req as CustomRequest).token, { ...req.body, task_id: req.params.task_id })
            res.status(200).send({ message: "Task " + req.params.task_id + " successfully deleted" })
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find task to delete") res.status(404).send({ errors: [err.message] })
            else if (err.message === "Logged user cannot delete this task") res.status(403).send({ errors: ["Cannot delete task"] })
            else res.status(500).send({ errors: ["Cannot delete task"] })
        }
    })

    /**
     * @openapi
     * /tasks/{task_id}/log:
     *   get:
     *     summary: Get task log
     *     description: Fetch the log file content for a specific task. Available to admins, task owners, and project members/managers.
     *     tags: [Tasks]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: task_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The task ID.
     *     responses:
     *       200:
     *         description: Task log content.
     *         content:
     *           application/json:
     *             schema:
     *               type: string
     *       403:
     *         description: User cannot be used or insufficient permissions.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Task not found.
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
    // Fetch log for admin or task owner or project member/managers
    router.get('/:task_id/log', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const taskId = parseInt(req.params.task_id);
            const logs = await getLogFileTaskUseCase.execute((req as CustomRequest).token, taskId);
            res.status(200).send(logs);
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find task") res.status(404).send({ errors: [err.message] });
            else if (err.message === "User does not have the necessary permissions to access this task.") res.status(403).send({ errors: ["Cannot get task log"] });
            else res.status(500).send({ errors: ["Cannot get task log"] });
        }
    });

    /**
     * @openapi
     * /tasks/{task_id}/file:
     *   get:
     *     summary: Download task file
     *     description: Stream the ZIP file produced by a task. Available to admins, task owners, and project members/managers.
     *     tags: [Tasks]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - name: task_id
     *         in: path
     *         required: true
     *         schema:
     *           type: integer
     *         description: The task ID.
     *     responses:
     *       200:
     *         description: ZIP file stream.
     *         content:
     *           application/zip:
     *             schema:
     *               type: string
     *               format: binary
     *       403:
     *         description: User cannot be used or insufficient permissions.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     *       404:
     *         description: Task or file not found.
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
    // Fetch task file for admin or task owner or project member/managers
    router.get('/:task_id/file', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const taskId = parseInt(req.params.task_id);
            await streamZipFileUseCase.execute((req as CustomRequest).token, taskId, res);
        } catch (err) {
            console.log(new Date().toISOString(), err)
            if (err.message === "User cannot be used") res.status(403).send({ errors: [err.message] })
            else if (err.message === "Cannot find task") res.status(404).send({ errors: [err.message] });
            else if (err.message === "ZIP file not found") res.status(404).send({ errors: [err.message] });
            else if (err.message === "Cannot find task file") res.status(404).send({ errors: [err.message] });
            else if (err.message === "User does not have the necessary permissions to access this task.") res.status(403).send({ errors: ["Cannot get task file"] });
            else res.status(500).send({ errors: ["Cannot get task file"] });
        }
    });

    return router
}