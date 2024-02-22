import { NextFunction, Request, Response } from "express"
import { ValidationChain } from "express-validator"

export interface IMiddlewareUserValidation {
    rulesGetUsers: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserRequesCreationtModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserRequestModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserUpdateModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
    rulesUserResponseModel: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => Response | undefined))[]
}


