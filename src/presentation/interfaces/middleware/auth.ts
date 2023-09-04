import { Request, Response, NextFunction } from 'express';

export interface MiddlewareAuth {
    auth(req: Request, res: Response, next: NextFunction): void
    auth_refresh(req: Request, res: Response, next: NextFunction): void
}


