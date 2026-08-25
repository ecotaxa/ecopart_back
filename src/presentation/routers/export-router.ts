import express from 'express'
import { Request, Response } from 'express'

import { MiddlewareAuth } from '../interfaces/middleware/auth'
import { IMiddlewareExportValidation } from '../middleware/export-validation'

import { ExportRawDataUseCase } from '../../domain/interfaces/use-cases/export/export-raw-data'
import { CustomRequest } from '../../domain/entities/auth'

export default function ExportRouter(
    middlewareAuth: MiddlewareAuth,
    middlewareExportValidation: IMiddlewareExportValidation,
    exportRawDataUseCase: ExportRawDataUseCase,
) {
    const router = express.Router()

    /**
     * @openapi
     * /exports/raw:
     *   post:
     *     summary: Export raw data for a list of samples (possibly across multiple projects)
     *     description: |
     *       Creates an asynchronous task that bundles the requested raw artifacts for the given samples into a single ZIP.
     *       The samples may span several projects; the archive is organised per project.
     *
     *       ### Pipeline
     *       1. **Authorization** — the caller must be usable, then must be admin *or* hold a privilege on
     *          **every distinct project** the requested samples belong to.
     *       2. **Resolution** — all `sample_ids` must resolve; any unknown id aborts the whole export (`404`).
     *       3. **Visual QC gate** — every requested sample must be in visual QC status `VALIDATED`.
     *          A single `PENDING` or `REJECTED` sample aborts the export with `409` and the offending
     *          sample names in the error message; nothing is exported partially. Pass
     *          `skip_not_validated=true` to accept a partial archive instead: the non-validated samples
     *          are then excluded and listed in the task log (`409` still applies if none remains).
     *       4. **Task** — a `EXPORT_RAW` task is created and returned immediately. Because the export can
     *          span projects, the task is deliberately **not** tied to a `task_project_id`.
     *       5. **Background build** — the archive is produced fire-and-forget, one step per requested export
     *          type, with progress reported on the task. Per-sample problems that are not fatal (no LPM file
     *          on disk, no CTD imported, project not linked to EcoTaxa, sample not imported into EcoTaxa)
     *          are **skipped with a warning line in the task log**, not failed.
     *
     *       ### Archive contents per export type
     *       - `metadata` → `metadata/projects.tsv` (one row per distinct project) + `metadata/samples.tsv`
     *         (one row per sample, ordered by `(ecopart_project_id, ecopart_sample_id)`). Tab-separated UTF-8,
     *         one header row, cells sanitised of tabs/CR/LF, booleans as `true`/`false`, timestamps ISO 8601 UTC.
     *       - `lpm` → `lpm/<project_id>/<sample_name>/…` the per-sample **particle data**, copied exactly as
     *         imported: UVP5 → `<sample>_work.zip` (datfile + HDR + bru); UVP6 → `<sample>_Particule.zip`
     *         (`particules.csv` + `metadata.ini`). Nothing else — vignettes and instrument configuration have
     *         their own export types below.
     *       - `images` → `images/<project_id>/<sample_name>/<sample>_Images.zip`, the vignettes. **UVP6 only**,
     *         and only for samples imported with images; a UVP5 sample produces nothing (noted in the task log).
     *       - `instrument_config` → `instrument_config/<project_id>/<sample_name>/<sample>_meta_conf.zip`, the
     *         instrument configuration and the **original acquisition headers** (`config/*`, `meta/uvp5_header_sn*.txt`,
     *         plus any `meta/old/` backups present in the source folder). **UVP5 only** — the UVP6 keeps its
     *         configuration in the `metadata.ini` shipped with `lpm`.
     *       - `ctd` → `ctd/<project_id>/<sample_name>.<ext>`, the CTD file as imported (extension of the source
     *         file, `.ctd` by default). Samples with no CTD import are skipped.
     *       - `ecotaxa` → `ecotaxa/<project_id>/ecotaxa_export_<project_id>.zip`, produced by calling EcoTaxa's
     *         `/object_set/{project_id}/export/general` API once per linked project. `ecotaxa_exclude_not_living=true`
     *         constrains it to the **biota** subtree (`taxo=1&taxochild=Y`). Unlike the skips above, an EcoTaxa
     *         API failure **fails the whole task**.
     *
     *       A `README.md` documenting every column is always generated at the root of the archive, from the same
     *       column constants the TSV writers use, so it cannot drift from the actual file contents.
     *
     *       ### Known issues / columns still empty
     *       - `sample_integration_time`: UVP5 only in the extended meta-header format — empty for the 21-column
     *         format shipped by Zooprocess. Filled for the UVP6 (`metadata.ini` `integrationtime`), empty when
     *         that value is `nan` (depth-mode samples).
     *       - `instrument_settings_process_datetime`: always empty — no UVP file carries the Zooprocess date
     *         (it is a manual field in legacy EcoPart and EcoPart has no editing screen for it yet).
     *       - `instrument_settings_depth_offset_m`: not carried by the UVP5 files (set it at project level);
     *         on the UVP6 an out-of-range value (`< 0` or `>= 100`) is discarded, as in legacy EcoPart.
     *       - `instrument_settings_process_gamma` / `instrument_settings_process_vignette_resize_factor`: read from
     *         `compute_vignette.txt` inside `<sample>_Images.zip`, so both are empty for UVP6 samples imported
     *         without images.
     *       - `ctd_latitude` / `ctd_longitude`: always empty — position is not part of the CTD data model.
     *       - **Units are instrument-dependent on two columns**: `sample_max_pressure` is raw (centibar for the
     *         UVP5, decibar for the UVP6 — multiply by `instrument_settings_acq_pressure_gain` to normalise) and
     *         `instrument_settings_pixel_size_mm` is mm on the UVP5 but µm on the UVP6. `instrument_settings_aa`
     *         is likewise 10^6 times larger on the UVP6. See the archive README, column by column.
     *       - The header values *inside* the copied `lpm` / `instrument_config` artifacts are still the original
     *         acquisition values and can disagree with `metadata/samples.tsv` (re-processed lat/long, ISO-normalised
     *         dates, serial-number convention).
     *       - **The project's descent filter is reported but not applied to the exported data.**
     *         `metadata/samples.tsv` states its outcome per sample (`filter_last_image_used`,
     *         `filter_removed_images_count`, `filter_removed_images_percent`, recomputed at export time), but the
     *         copied `lpm` files still contain the ascent images EcoPart discards when it computes its own
     *         histograms — so abundances recomputed straight from this archive will differ from EcoPart's unless
     *         the consumer re-applies the filter. `filter_last_image` remains the raw header value (often the
     *         sentinel 99999999999).
     *
     *       The endpoint returns the created task immediately; the resulting ZIP is downloadable at
     *       `/api/tasks/{task_id}/file` once the task reaches the `DONE` status.
     *     tags: [Exports]
     *     security:
     *       - cookieAccessToken: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [sample_ids, export_types]
     *             properties:
     *               sample_ids:
     *                 type: array
     *                 minItems: 1
     *                 items: { type: integer, minimum: 1 }
     *                 description: Ids of the samples to export. May belong to several projects.
     *               export_types:
     *                 type: array
     *                 minItems: 1
     *                 description: One or more export types. Duplicates are ignored; order is preserved.
     *                 items:
     *                   type: string
     *                   enum: [metadata, lpm, images, instrument_config, ctd, ecotaxa]
     *               ecotaxa_exclude_not_living:
     *                 type: boolean
     *                 description: >
     *                   Required only when "ecotaxa" is included in export_types. When true, the EcoTaxa export is
     *                   constrained to the biota subtree (taxo=1, taxochild=Y). Defaults to false otherwise.
     *               skip_not_validated:
     *                 type: boolean
     *                 default: false
     *                 description: >
     *                   Opt-out of the all-or-nothing visual-QC gate. False (default): a single sample that is not
     *                   VALIDATED aborts the export with 409. True: those samples are dropped from the archive and
     *                   listed in the task log, and the export proceeds with the validated ones. 409 is still
     *                   returned when no validated sample remains.
     *     responses:
     *       200:
     *         description: Task created. Poll the task and download the file once done.
     *       401:
     *         description: User not authorized for one of the projects the requested samples belong to.
     *       403:
     *         description: User cannot be used.
     *       404:
     *         description: Sample or project not found — no sample resolved, or some requested ids do not exist.
     *       409:
     *         description: >
     *           At least one requested sample has not passed visual QC (status is not VALIDATED). The error message
     *           lists the offending sample names. Nothing is exported. With skip_not_validated=true this is only
     *           returned when no validated sample remains at all.
     *       422:
     *         description: Validation error.
     *       500:
     *         description: Internal server error.
     */
    router.post('/raw', middlewareAuth.auth, middlewareExportValidation.rulesExportRawData, async (req: Request, res: Response) => {
        try {
            const task = await exportRawDataUseCase.execute((req as CustomRequest).token, {
                sample_ids: req.body.sample_ids,
                export_types: req.body.export_types,
                ecotaxa_exclude_not_living: req.body.ecotaxa_exclude_not_living,
                skip_not_validated: req.body.skip_not_validated,
            });
            res.status(200).send(task)
        } catch (err) {
            console.log(new Date().toISOString(), err)
            const msg: string = err?.message || "";
            if (msg === "User cannot be used") res.status(403).send({ errors: [msg] })
            else if (msg.startsWith("Logged user cannot export raw data")) res.status(401).send({ errors: [msg] })
            else if (msg === "Cannot find project" || msg === "No samples found" || msg.startsWith("Sample(s) not found")) res.status(404).send({ errors: [msg] })
            else if (msg.startsWith("Sample(s) not validated")) res.status(409).send({ errors: [msg] })
            else if (msg === "Task type not found" || msg === "Task status not found" || msg === "Cannot find task" || msg === "Task not found") res.status(404).send({ errors: [msg] })
            else if (msg === "Cannot create log file") res.status(500).send({ errors: [msg] })
            else res.status(500).send({ errors: ["Cannot export raw data"] })
        }
    })

    return router
}
