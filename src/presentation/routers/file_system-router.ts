import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { ListImportFoldersUseCase } from '../../domain/interfaces/use-cases/file_system/list-import-folders'
import { GetImportFolderMetadataUseCase } from '../../domain/interfaces/use-cases/file_system/get-import-folder-metadata'

export default function FileSystemRouter(
    middlewareAuth: MiddlewareAuth,
    listImportFoldersUseCase: ListImportFoldersUseCase,
    getImportFolderMetadataUseCase: GetImportFolderMetadataUseCase
) {
    const router = express.Router()

    /**
     * @openapi
     * /file_system/import_folders:
     *   get:
     *     summary: List import folders
     *     description: Returns the list of folder paths directly under the given path within the data import directory.
     *     tags: [File System]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - in: query
     *         name: folder_path
     *         required: false
     *         schema:
     *           type: string
     *         description: Path relative to the import root. If omitted, lists folders at the import root.
     *     responses:
     *       200:
     *         description: List of import folder paths.
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: string
     *       400:
     *         description: Bad request (missing or invalid folder_path).
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
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
            const folder_path = (req.query.folder_path as string) || '';
            const folders = await listImportFoldersUseCase.execute(folder_path);
            res.status(200).send(folders)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            res.status(500).send({ errors: ["Cannot list import folders"] })
        }
    })

    /**
     * @openapi
     * /file_system/import_folder_metadata:
     *   get:
     *     summary: Get metadata from an import folder
     *     description: |
     *       Reads metadata files from the given import folder path and returns project-level metadata to pre-fill the project creation form. Works for both UVP5 and UVP6 folder structures.
     *
     *       **Files read:**
     *       - `config/cruise_info.txt` — INI-style file (`[General]` section) containing cruise/project info and contact details.
     *       - `meta/*header*.txt` — Semicolon-delimited CSV. The first data row provides cruise and ship names.
     *
     *       **Instrument detection:**
     *       - Presence of an `ecodata/` subdirectory → UVP6
     *       - Presence of a `work/` subdirectory → UVP5
     *       - The exact model (e.g. UVP6LP, UVP5HD) is deduced from the serial number suffix.
     *
     *       **User lookup:** For each person (data_owner, operator, chief_scientist), the email is looked up in the EcoPart user database. If a match is found, `ecopart_user_id` is returned.
     *     tags: [File System]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - in: query
     *         name: folder_path
     *         required: true
     *         schema:
     *           type: string
     *         description: The full path of the import folder (as returned by /file_system/import_folders).
     *     responses:
     *       200:
     *         description: Project metadata extracted from the import folder.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ProjectMetadata'
     *       400:
     *         description: Bad request (missing or invalid folder_path).
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
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
    router.get('/import_folder_metadata', middlewareAuth.auth, async (req: Request, res: Response) => {
        try {
            const folder_path = req.query.folder_path as string;
            if (!folder_path) {
                res.status(400).send({ errors: ["Missing folder_path query parameter"] });
                return;
            }
            const metadata = await getImportFolderMetadataUseCase.execute(folder_path);
            res.status(200).send(metadata);
        } catch (err) {
            console.log(new Date().toISOString(), err);
            if (err.message === 'Invalid folder path') {
                res.status(400).send({ errors: ["Invalid folder path"] });
            } else {
                res.status(500).send({ errors: ["Cannot read import folder metadata"] });
            }
        }
    })

    return router
}
