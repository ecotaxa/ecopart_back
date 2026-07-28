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
     *       Nothing is written and nothing is imported: the endpoint only reads. Every field is
     *       best-effort — a missing or malformed source file yields `null` fields, not an error.
     *
     *       **Where each returned field is read from:**
     *
     *       | Field | Source |
     *       | --- | --- |
     *       | `project_acronym` | `config/cruise_info.txt` → `acron` |
     *       | `project_description` | `config/cruise_info.txt` → `description` |
     *       | `cruise` | `meta/*header*.txt` → field 1 of the first data row; fallback `config/cruise_info.txt` → `acron` |
     *       | `ship` | `meta/*header*.txt` → field 2 of the first data row |
     *       | `serial_number` | `config/cruise_info.txt` → `sn`; fallback: the `sn…` part of the `meta/*header*.txt` **file name**. Rewritten with the family convention: `sn` prefix for UVP5 (`sn002zd`), none for UVP6 (`000241LP`) |
     *       | `instrument_model` | Deduced: `ecodata/` → UVP6 / `work/` → UVP5, refined by the `serial_number` suffix (LP, HF, MHP, MHF, hd, sd, zd) |
     *       | `data_owner` | `config/cruise_info.txt` → `do_name`, `do_email` |
     *       | `operator` | `config/cruise_info.txt` → `op_name`, `op_email` |
     *       | `chief_scientist` | `config/cruise_info.txt` → `cs_name`, `cs_email` |
     *
     *       **File selection & parsing:**
     *       - `config/cruise_info.txt` — INI-like `key=value`; section headers (`[...]`), `;`/`#` comments, blank lines and empty values are skipped.
     *       - `meta/*header*.txt` — first file of `meta/` containing `header`, ending in `.txt`, and **not** containing `backup`; semicolon-delimited, only the first data row (line 2) is read.
     *
     *       **User lookup:** For each person (data_owner, operator, chief_scientist), the email is looked up in the EcoPart user database. If a match is found, `ecopart_user_id` is returned, otherwise it is null.
     *     tags: [File System]
     *     security:
     *       - cookieAccessToken: []
     *     parameters:
     *       - in: query
     *         name: folder_path
     *         required: true
     *         schema:
     *           type: string
     *         description: Path relative to the import root (as returned by /file_system/import_folders).
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
