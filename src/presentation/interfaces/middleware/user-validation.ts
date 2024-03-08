import { NextFunction, Request, Response } from "express"
import { ContextRunner, ValidationChain } from "express-validator"
import { Middleware } from "express-validator/src/base"

export interface IMiddlewareUserValidation {
    rulesGetUsers: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserRequesCreationtModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserRequestModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserUpdateModel: ((Middleware & ContextRunner) | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserResponseModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


