import { Request, Response, NextFunction } from 'express';

export interface MiddlewareAuth {
    auth(req: Request, res: Response, next: NextFunction): void
    // Serves anonymous callers too: no cookie passes without a token, a bad cookie is still a 401.
    auth_optional(req: Request, res: Response, next: NextFunction): void
    auth_refresh(req: Request, res: Response, next: NextFunction): void
}


