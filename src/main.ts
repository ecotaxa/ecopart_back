import server from './server'

import { MiddlewareAuthCookie } from './presentation/middleware/auth-cookie'
import { MiddlewareAuthValidation } from './presentation/middleware/auth-validation'
import { MiddlewareUserValidation } from './presentation/middleware/user-validation'
import { MiddlewareProjectValidation } from './presentation/middleware/project-validation'

import UserRouter from './presentation/routers/user-router'
import AuthRouter from './presentation/routers/auth-router'
import InstrumentModelRouter from './presentation/routers/instrument_model-router'
import ProjectRouter from './presentation/routers/project-router'

import { SearchUsers } from './domain/use-cases/user/search-users'
import { CreateUser } from './domain/use-cases/user/create-user'
import { UpdateUser } from './domain/use-cases/user/update-user'
import { LoginUser } from './domain/use-cases/auth/login'
import { RefreshToken } from './domain/use-cases/auth/refresh-token'
import { ChangePassword } from './domain/use-cases/auth/change-password'
import { ValidUser } from './domain/use-cases/user/valid-user'
import { ResetPasswordRequest } from './domain/use-cases/auth/reset-password-request'
import { ResetPassword } from './domain/use-cases/auth/reset-password'
import { DeleteUser } from './domain/use-cases/user/delete-user'
import { CreateProject } from './domain/use-cases/project/create-project'
import { DeleteProject } from './domain/use-cases/project/delete-project'
import { UpdateProject } from './domain/use-cases/project/update-project'
import { SearchProject } from './domain/use-cases/project/search-projects'
import { GetOneInstrumentModel } from './domain/use-cases/instrument_model/get-one-instrument_model'
import { SearchInstrumentModels } from './domain/use-cases/instrument_model/search-instrument_model'

import { UserRepositoryImpl } from './domain/repositories/user-repository'
import { AuthRepositoryImpl } from './domain/repositories/auth-repository'
import { SearchRepositoryImpl } from './domain/repositories/search-repository'
import { InstrumentModelRepositoryImpl } from './domain/repositories/instrument_model-repository'
import { ProjectRepositoryImpl } from './domain/repositories/project-repository'
import { PrivilegeRepositoryImpl } from './domain/repositories/privilege-repository'


import { SQLiteUserDataSource } from './data/data-sources/sqlite/sqlite-user-data-source'
import { SQLiteInstrumentModelDataSource } from './data/data-sources/sqlite/sqlite-instrument_model-data-source'
import { SQLiteProjectDataSource } from './data/data-sources/sqlite/sqlite-project-data-source'
import { SQLitePrivilegeDataSource } from './data/data-sources/sqlite/sqlite-privilege-data-source'
import sqlite3 from 'sqlite3'

import { BcryptAdapter } from './infra/cryptography/bcript'
import { JwtAdapter } from './infra/auth/jsonwebtoken'
import { NodemailerAdapter } from './infra/mailer/nodemailer'
import { CountriesAdapter } from './infra/countries/country'

import 'dotenv/config'
import path from 'path'

sqlite3.verbose()

const config = {
    DBSOURCE_NAME: process.env.DBSOURCE_NAME || '',
    DBSOURCE_FOLDER: process.env.DBSOURCE_FOLDER || '',

    PORT_LOCAL: parseInt(process.env.PORT_LOCAL as string, 10),
    BASE_URL_LOCAL: process.env.BASE_URL_LOCAL || '',
    PORT_PUBLIC: parseInt(process.env.PORT_LOCAL as string, 10),
    BASE_URL_PUBLIC: process.env.BASE_URL_PUBLIC || '',

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

    NODE_ENV: process.env.NODE_ENV || '',
}
async function getSQLiteDS() {
    const db = new sqlite3.Database(path.resolve(config.DBSOURCE_FOLDER, config.DBSOURCE_NAME), (err) => {
        if (err) {
            // Cannot open database
            console.error(err.message)
            throw err
        } else {
            console.log('Connected to the SQLite database.')
        }
    });
    // Enable foreign keys in sqlite
    db.get("PRAGMA foreign_keys = ON")

    return db
}

(async () => {
    const db = await getSQLiteDS();

    const bcryptAdapter = new BcryptAdapter()
    const jwtAdapter = new JwtAdapter()
    const mailerAdapter = new NodemailerAdapter((config.BASE_URL_PUBLIC + config.PORT_PUBLIC), config.MAIL_SENDER, config.NODE_ENV)
    const countriesAdapter = new CountriesAdapter()

    const user_dataSource = new SQLiteUserDataSource(db)
    const instrument_model_dataSource = new SQLiteInstrumentModelDataSource(db)
    const project_dataSource = new SQLiteProjectDataSource(db)
    const privilege_dataSource = new SQLitePrivilegeDataSource(db)

    const transporter = await mailerAdapter.createTransport({
        host: config.MAIL_HOST,
        port: config.MAIL_PORT,
        secure: config.MAIL_SECURE,
        auth: {
            user: config.MAIL_AUTH_USER,
            pass: config.MAIL_AUTH_PASS,
        },

    })
    const user_repo = new UserRepositoryImpl(user_dataSource, bcryptAdapter, jwtAdapter, config.VALIDATION_TOKEN_SECRET, config.RESET_PASSWORD_TOKEN_SECRET)
    const auth_repo = new AuthRepositoryImpl(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET)
    const search_repo = new SearchRepositoryImpl()
    const instrument_model_repo = new InstrumentModelRepositoryImpl(instrument_model_dataSource)
    const project_repo = new ProjectRepositoryImpl(project_dataSource)
    const privilege_repo = new PrivilegeRepositoryImpl(privilege_dataSource)

    const userMiddleWare =
        UserRouter(
            new MiddlewareAuthCookie(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET),
            new MiddlewareUserValidation(countriesAdapter),
            new CreateUser(user_repo, transporter, mailerAdapter),
            new UpdateUser(user_repo),
            new ValidUser(user_repo),
            new DeleteUser(user_repo, privilege_repo),
            new SearchUsers(user_repo, search_repo),
        )
    const authMiddleWare = AuthRouter(
        new MiddlewareAuthCookie(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET),
        new MiddlewareAuthValidation(),
        new LoginUser(user_repo, auth_repo),
        new RefreshToken(user_repo, auth_repo),
        new ChangePassword(user_repo),
        new ResetPasswordRequest(user_repo, transporter, mailerAdapter),
        new ResetPassword(user_repo),
    )
    const instrumentModelMiddleWare = InstrumentModelRouter(
        new GetOneInstrumentModel(instrument_model_repo),
        new SearchInstrumentModels(instrument_model_repo, search_repo)
    )
    const projectMiddleWare = ProjectRouter(
        new MiddlewareAuthCookie(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET),
        new MiddlewareProjectValidation(),
        new CreateProject(user_repo, project_repo, instrument_model_repo, privilege_repo),
        new DeleteProject(user_repo, project_repo, privilege_repo),
        new UpdateProject(user_repo, project_repo, instrument_model_repo, privilege_repo),
        new SearchProject(user_repo, project_repo, search_repo, instrument_model_repo, privilege_repo),
    )

    server.use("/users", userMiddleWare)
    server.use("/auth", authMiddleWare)
    server.use("/instrument_models", instrumentModelMiddleWare)
    server.use("/projects", projectMiddleWare)

    server.listen(config.PORT_LOCAL, () => console.log("Running on ", config.BASE_URL_LOCAL, config.PORT_LOCAL))

})()
