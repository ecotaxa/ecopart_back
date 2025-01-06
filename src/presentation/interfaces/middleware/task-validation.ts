import { NextFunction, Request, Response } from "express"
import { ValidationChain } from "express-validator"

export interface IMiddlewareTaskValidation {
    rulesGetTasks: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}
