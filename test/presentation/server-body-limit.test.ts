import request from 'supertest'
import { Request, Response } from 'express'
import server from '../../src/server'

// About 30 000 sample ids: over the 100 KB default of express.json().
const large_body = { sample_ids: Array.from({ length: 30_000 }, (_, i) => 100_000 + i) }

describe('JSON body limit', () => {
    beforeAll(() => {
        const count = (req: Request, res: Response) => { res.status(200).send({ count: req.body.sample_ids.length }) }
        server.post('/exports/body-limit-probe', count)
        server.post('/other/body-limit-probe', count)
    })

    test('an export request may list tens of thousands of sample ids', async () => {
        expect(JSON.stringify(large_body).length).toBeGreaterThan(100 * 1024)

        const response = await request(server).post('/exports/body-limit-probe').send(large_body)

        expect(response.status).toBe(200)
        expect(response.body).toStrictEqual({ count: 30_000 })
    })

    test('the other routes keep the 100 KB default', async () => {
        const response = await request(server).post('/other/body-limit-probe').send(large_body)

        expect(response.status).toBe(413)
    })
})
