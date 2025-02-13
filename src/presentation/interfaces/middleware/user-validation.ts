import { NextFunction, Request, Response } from "express"
import { ContextRunner, ValidationChain } from "express-validator"
import { Middleware } from "express-validator/src/base"

export interface IMiddlewareUserValidation {
    rulesGetUsers: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserRequestCreationModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserUpdateModel: ((Middleware & ContextRunner) | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesLogoutEcoTaxaAccount: ((Middleware & ContextRunner) | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


