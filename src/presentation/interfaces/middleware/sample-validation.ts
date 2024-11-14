// TODO IMiddlewareSampleValidation
import { NextFunction, Request, Response } from "express"
import { ValidationChain } from "express-validator"

export interface IMiddlewareSampleValidation {
    rulesGetSamples: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    // rulesSampleRequestCreationModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    // rulesSampleUpdateModel: ((Middleware & ContextRunner) | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}

