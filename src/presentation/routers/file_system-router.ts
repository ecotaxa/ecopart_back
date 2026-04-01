import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { ListImportFoldersUseCase } from '../../domain/interfaces/use-cases/file_system/list-import-folders'

export default function FileSystemRouter(
    middlewareAuth: MiddlewareAuth,
    listImportFoldersUseCase: ListImportFoldersUseCase
) {
    const router = express.Router()

    /**
     * @openapi
     * /file_system/import_folders:
     *   get:
     *     summary: List import folders
     *     description: Returns the list of folder paths under the data import directory.
     *     tags: [File System]
     *     security:
     *       - cookieAccessToken: []
     *     responses:
     *       200:
     *         description: List of import folder paths.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       401:
     *         description: Unauthorized.
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
    router.get('/import_folders', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const folders = await listImportFoldersUseCase.execute();
            res.status(200).send(folders)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            res.status(500).send({ errors: ["Cannot list import folders"] })
        }
    })

    return router
}
