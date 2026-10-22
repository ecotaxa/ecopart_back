import { JwtPayload, Secret, SignOptions, VerifyOptions } from "jsonwebtoken";
import * as jwt from "jsonwebtoken"
import { JwtWrapper } from "./jwt-wrapper";

export class JwtAdapter implements JwtWrapper {
    // sign token
    sign(payload: string | Buffer | object, secretOrPrivateKey: Secret, options?: SignOptions): string {
        return jwt.sign(payload, secretOrPrivateKey, options)
    }
    // veryfy token
    verify(token: string, secretOrPublicKey: Secret, options?: VerifyOptions & { complete?: false }): JwtPayload | string {
        // Pinned so a token can never pick its own algorithm (HS256 is what sign() uses by default)
        return jwt.verify(token, secretOrPublicKey, { ...options, algorithms: ['HS256'] })
    }
}


