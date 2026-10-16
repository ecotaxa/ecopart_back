import express, { Request, Response } from 'express'

export default function VersionRouter(version: string) {
    const router = express.Router()

    /**
     * @openapi
     * /version:
     *   get:
     *     summary: Running version
     *     description: The git tag the running image was built from, or "dev" outside a tagged image. No authentication.
     *     tags: [Version]
     *     responses:
     *       200:
     *         description: The running version.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 version:
     *                   type: string
     *                   example: "v0.0.78"
     */
    router.get('/', (_req: Request, res: Response) => {
        res.status(200).send({ version })
    })

    return router
}
