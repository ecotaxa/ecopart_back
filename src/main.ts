import server from './server'
import UserRouter from './presentation/routers/user-router'
import { GetAllUsers } from './domain/use-cases/user/get-all-users'
import { UserRepositoryImpl } from './domain/repositories/user-repository'
import { CreateUser } from './domain/use-cases/user/create-user'
import { SQLiteUserDataSource } from './data/data-sources/sqlite/sqlite-user-data-source'
import sqlite3 from 'sqlite3'
import { BcryptAdapter } from './infra/cryptography/bcript'
sqlite3.verbose()

const DBSOURCE = 'ecopart.db'// TODO TAKE IT FROM CONFIG

async function getSQLiteDS() {
    const db = new sqlite3.Database(DBSOURCE, (err) => {
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

    const salt = 12 // TODO TAKE IT FROM CONFIG
    const bcryptAdapter = new BcryptAdapter(salt)

    const userMiddleWare = UserRouter(
        new GetAllUsers(new UserRepositoryImpl(dataSource, bcryptAdapter)),
        new CreateUser(new UserRepositoryImpl(dataSource, bcryptAdapter)),
    )

    server.use("/users", userMiddleWare)
    server.listen(4000, () => console.log("Running on http://localhost:4000"))

})()
