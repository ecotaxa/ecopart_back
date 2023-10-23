import server from './server'
import { MiddlewareAuthCookie } from './presentation/middleware/auth_cookie'
import UserRouter from './presentation/routers/user-router'
import AuthRouter from './presentation/routers/auth-router'

import { GetAllUsers } from './domain/use-cases/user/get-all-users'
import { CreateUser } from './domain/use-cases/user/create-user'
import { UpdateUser } from './domain/use-cases/user/update-user'
import { LoginUser } from './domain/use-cases/auth/login'
import { RefreshToken } from './domain/use-cases/auth/refreshToken'

import { UserRepositoryImpl } from './domain/repositories/user-repository'
import { AuthRepositoryImpl } from './domain/repositories/auth-repository'
import { SQLiteUserDataSource } from './data/data-sources/sqlite/sqlite-user-data-source'
import sqlite3 from 'sqlite3'

import { BcryptAdapter } from './infra/cryptography/bcript'
import { JwtAdapter } from './infra/auth/jsonwebtoken'
import 'dotenv/config'

sqlite3.verbose()

const config = {
    PORT: parseInt(process.env.PORT as string, 10),
    DBSOURCE: process.env.DBSOURCE || 'ecopart.db',
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || '',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || '',
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


    const userMiddleWare = UserRouter(
        new MiddlewareAuthCookie(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET),
        new GetAllUsers(new UserRepositoryImpl(dataSource, bcryptAdapter)),
        new CreateUser(new UserRepositoryImpl(dataSource, bcryptAdapter)),
        new UpdateUser(new UserRepositoryImpl(dataSource, bcryptAdapter))
    )
    const authMiddleWare = AuthRouter(
        new MiddlewareAuthCookie(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET),
        new LoginUser(new UserRepositoryImpl(dataSource, bcryptAdapter), new AuthRepositoryImpl(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET)),
        new RefreshToken(new UserRepositoryImpl(dataSource, bcryptAdapter), new AuthRepositoryImpl(jwtAdapter, config.ACCESS_TOKEN_SECRET, config.REFRESH_TOKEN_SECRET)),
    )

    server.use("/users", userMiddleWare)
    server.use("/auth", authMiddleWare)

    server.listen(config.PORT, () => console.log("Running on http://localhost:", config.PORT))

})()
