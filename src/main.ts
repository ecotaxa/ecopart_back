import server from './server'
import { MiddlewareAuthCookie } from './presentation/middleware/auth-cookie'
import { MiddlewareAuthValidation } from './presentation/middleware/auth-validation'
import { MiddlewareUserValidation } from './presentation/middleware/user-validation'
import UserRouter from './presentation/routers/user-router'
import AuthRouter from './presentation/routers/auth-router'

import { GetAllUsers } from './domain/use-cases/user/get-all-users'
import { CreateUser } from './domain/use-cases/user/create-user'
import { UpdateUser } from './domain/use-cases/user/update-user'
import { LoginUser } from './domain/use-cases/auth/login'
import { RefreshToken } from './domain/use-cases/auth/refresh-token'
import { ChangePassword } from './domain/use-cases/auth/change-password'
import { ValidUser } from './domain/use-cases/user/valid-user'
import { ResetPasswordRequest } from './domain/use-cases/auth/reset-password-request'
import { ResetPassword } from './domain/use-cases/auth/reset-password'

import { UserRepositoryImpl } from './domain/repositories/user-repository'
import { AuthRepositoryImpl } from './domain/repositories/auth-repository'
import { SQLiteUserDataSource } from './data/data-sources/sqlite/sqlite-user-data-source'
import sqlite3 from 'sqlite3'

import { BcryptAdapter } from './infra/cryptography/bcript'
import { JwtAdapter } from './infra/auth/jsonwebtoken'
import { NodemailerAdapter } from './infra/mailer/nodemailer'
import { CountriesAdapter } from './infra/countries/country'

import 'dotenv/config'

sqlite3.verbose()

const config = {
    PORT: parseInt(process.env.PORT as string, 10),
    DBSOURCE: process.env.DBSOURCE || '',
    BASE_URL: process.env.BASE_URL || '',
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || '',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || '',
    VALIDATION_TOKEN_SECRET: process.env.VALIDATION_TOKEN_SECRET || '',
    RESET_PASSWORD_TOKEN_SECRET: process.env.RESET_PASSWORD_TOKEN_SECRET || '',

    MAIL_HOST: process.env.MAIL_HOST || '',
    MAIL_PORT: parseInt(process.env.MAIL_PORT as string, 10),
    MAIL_SECURE: process.env.MAIL_SECURE || '',
    MAIL_AUTH_USER: process.env.MAIL_AUTH_USER || '',
    MAIL_AUTH_PASS: process.env.MAIL_AUTH_PASS || '',
    MAIL_SENDER: process.env.MAIL_SENDER || '',
}

async function getSQLiteDS() {
    const db = new sqlite3.Database(config.DBSOURCE, (err) => {
        if (err) {
            // Cannot open database
            console.error(err.message)
            throw err
        } else {
            console.log('Connected to the SQLite database.')
        }
    });

    return new SQLiteUserDataSource(db)
}

(async () => {
    const dataSource = await getSQLiteDS();

    const bcryptAdapter = new BcryptAdapter()
    const jwtAdapter = new JwtAdapter()
    const mailerAdapter = new NodemailerAdapter((config.BASE_URL + config.PORT), config.MAIL_SENDER)
    const countriesAdapter = new CountriesAdapter()

    const transporter = await mailerAdapter.createTransport({
        host: config.MAIL_HOST,
        port: config.MAIL_PORT,
        secure: config.MAIL_SECURE,
        auth: {
            user: config.MAIL_AUTH_USER,
            pass: config.MAIL_AUTH_PASS,
        },

    })

    const userMiddleWare = UserRouter(
        new MiddlewareAuthCookie(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET),
        new MiddlewareUserValidation(countriesAdapter),
        new GetAllUsers(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET)),
        new CreateUser(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET), transporter, mailerAdapter),
        new UpdateUser(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET)),
        new ValidUser(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET)),
    )
    const authMiddleWare = AuthRouter(
        new MiddlewareAuthCookie(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET),
        new MiddlewareAuthValidation(),
        new LoginUser(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET), new AuthRepositoryImpl(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET)),
        new RefreshToken(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET), new AuthRepositoryImpl(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET)),
        new ChangePassword(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET)),
        new ResetPasswordRequest(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET), transporter, mailerAdapter),
        new ResetPassword(new UserRepositoryImpl(dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET)),
    )

    server.use("/users", userMiddleWare)
    server.use("/auth", authMiddleWare)

    server.listen(config.PORT, () => console.log("Running on ", config.BASE_URL, config.PORT))

})()
