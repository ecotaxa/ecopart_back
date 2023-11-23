import { NextFunction, Request, Response } from "express"
import { ValidationChain } from "express-validator"
export interface IMiddlewareAuthValidation {
    rulesAuthUserCredentialsModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


