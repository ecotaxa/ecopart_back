// TODO IMiddlewareSampleValidation
import { NextFunction, Request, Response } from "express"
import { ValidationChain } from "express-validator"

export interface IMiddlewareSampleValidation {
    rulesGetSamples: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesSetVisualQc: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesPreviewQcGraphs: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


