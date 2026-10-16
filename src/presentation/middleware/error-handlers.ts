import { NextFunction, Request, Response } from 'express';

interface HttpLikeError {
    status?: number;
    type?: string;
    expose?: boolean;
    message?: string;
}

// Unknown route: a JSON answer like every other error of the API, instead of Express's HTML page.
export function notFoundHandler(_req: Request, res: Response): void {
    res.status(404).send({ errors: ["Route not found"] })
}

// Errors no router caught, mostly from the body parsers (malformed JSON, body too large). Express's own
// handler answers with an HTML page holding the stack trace whenever NODE_ENV is not "production", and
// this API runs with NODE_ENV=PROD.
export function errorHandler(err: HttpLikeError, _req: Request, res: Response, next: NextFunction): void {
    if (res.headersSent) return next(err)

    const status = Number.isInteger(err?.status) && (err.status as number) >= 400 && (err.status as number) < 500 ? err.status as number : 500
    if (status === 500) console.log(new Date().toISOString(), err)

    let message = "Internal server error"
    if (status !== 500) {
        if (err.type === "entity.parse.failed") message = "Malformed JSON body"
        else message = err.expose && err.message ? err.message : "Bad request"
    }
    res.status(status).send({ errors: [message] })
}
