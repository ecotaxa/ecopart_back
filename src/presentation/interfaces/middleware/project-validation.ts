// TODO IMiddlewareProjectValidation
import { NextFunction, Request, Response } from "express"
import { ContextRunner, ValidationChain } from "express-validator"
import { Middleware } from "express-validator/src/base"

export interface IMiddlewareProjectValidation {
    rulesGetProjects: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectRequestCreationModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectUpdateModel: ((Middleware & ContextRunner) | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectBackup: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesProjectBackupFromImport: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


