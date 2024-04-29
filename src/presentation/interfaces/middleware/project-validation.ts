// TODO IMiddlewareProjectValidation
import { NextFunction, Request, Response } from "express"
import { ContextRunner, ValidationChain } from "express-validator"
import { Middleware } from "express-validator/src/base"

export interface IMiddlewareProjectValidation {
    rulesGetProjects: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectRequestCreationtModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectRequestModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectUpdateModel: ((Middleware & ContextRunner) | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectResponseModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


