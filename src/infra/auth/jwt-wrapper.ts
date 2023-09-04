import { JwtPayload, Secret, SignOptions, VerifyOptions } from "jsonwebtoken";

export interface JwtWrapper {
    sign(
        payload: string | Buffer | object,
        secretOrPrivateKey: Secret,
        options?: SignOptions,
    ): string;

    verify(
        token: string,
        secretOrPublicKey: Secret,
        options?: VerifyOptions & { complete?: false }
    ): JwtPayload | string;

}