import { NextFunction, Request, Response } from "express"
import { ValidationChain } from "express-validator"
export interface IMiddlewareAuthValidation {
    rulesPassword: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesAuthUserCredentialsModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesRequestResetPassword: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesResetPassword: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


