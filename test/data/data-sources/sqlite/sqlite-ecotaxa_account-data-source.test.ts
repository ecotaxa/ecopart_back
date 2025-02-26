import { SQLiteEcotaxaAccountDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-ecotaxa_account-data-source'
import { SQLiteUserDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-user-data-source';

import { EcotaxaAccountRequestCreationModel } from '../../../../src/domain/entities/ecotaxa_account';
import { ecotaxaAccountRequestCreationModel, ecotaxaAccountRequestCreationModel_unexistingUser, ecotaxaAccountResponseModel_lena } from '../../../entities/user';
import fs from 'fs';
import sqlite3 from 'sqlite3'

const config = {
    TEST_DBSOURCE: 'TEST_DB_SOURCE_ECOTAXA_ACCOUNT'
}

function initializeDB() {
    const db = new sqlite3.Database(config.TEST_DBSOURCE, (err) => {
        if (err) {
            // Cannot open database
            console.error(err.message)
            throw err
        }
    });
    // Enable foreign keys in sqlite
    db.get("PRAGMA foreign_keys = ON")

    return db
}
function initializeUserDB(db: sqlite3.Database) {
    return new SQLiteUserDataSource(db)
}
function initializeEcotaxaAccountDB(db: sqlite3.Database) {
    return new SQLiteEcotaxaAccountDataSource(db)
}

function cleanDB() {
    try {
        // Delete db file
        fs.unlinkSync(config.TEST_DBSOURCE);
        console.log("Database file deleted successfully.");
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("Database file does not exist. No action needed.");
        } else {
            console.error("Error occurred while deleting database file:", error);
        }
    }
}

describe('SQLiteEcotaxaAccountDataSource', () => {
    let db: sqlite3.Database;
    let dataSource_EcotaxaAccount: SQLiteEcotaxaAccountDataSource;
    let dataSource_User: SQLiteUserDataSource;

    beforeAll(async () => {
        db = initializeDB();
        dataSource_EcotaxaAccount = initializeEcotaxaAccountDB(db);
        dataSource_User = initializeUserDB(db);

        // wait for the database to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
    });

    afterAll(() => {
        cleanDB();
    });

    describe('create', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource_EcotaxaAccount).toBeDefined();
            expect(dataSource_User).toBeDefined();
        });

        test('should create a new ecotaxa_account', async () => {
            const ecotaxa_account: EcotaxaAccountRequestCreationModel = ecotaxaAccountRequestCreationModel

            // Call the create method
            const ecotaxa_accountId = await dataSource_EcotaxaAccount.create(ecotaxa_account);

            // Expect the ecotaxa_account ID to be returned
            expect(ecotaxa_accountId).toBeDefined();
            // Expect the ecotaxa_account ID to be returned
            expect(ecotaxa_accountId).toEqual(1);

        });
        test('should not create an ecotaxa_account if the user does not exist', async () => {
            const ecotaxa_account: EcotaxaAccountRequestCreationModel = ecotaxaAccountRequestCreationModel_unexistingUser

            // Call the create method
            try {
                await dataSource_EcotaxaAccount.create(ecotaxa_account);
            } catch (error) {
                expect(error).toBeDefined();
                expect(error.message).toEqual("SQLITE_CONSTRAINT: FOREIGN KEY constraint failed");
            }
        });
        test('should not create an ecotaxa_account for the same account (instance email and ecopart user id) ', async () => {
            const ecotaxa_account: EcotaxaAccountRequestCreationModel = ecotaxaAccountRequestCreationModel

            // Call the create method
            try {
                await dataSource_EcotaxaAccount.create(ecotaxa_account);
            } catch (error) {
                expect(error).toBeDefined();
                expect(error.message).toEqual("SQLITE_CONSTRAINT: UNIQUE constraint failed: ecotaxa_account.ecotaxa_account_instance_id, ecotaxa_account.ecotaxa_account_user_email, ecotaxa_account.ecotaxa_account_ecopart_user_id");
            }
        });
    });
    describe('getOne', () => {
        test('should get the ecotaxa_account', async () => {
            const ecotaxa_account = await dataSource_EcotaxaAccount.getOne(1);

            expect(ecotaxa_account).toBeDefined();
            // to be equal exept creation date
            expect(ecotaxa_account).toMatchObject({
                ...ecotaxaAccountResponseModel_lena,
                ecotaxa_account_creation_date: expect.any(String)
            });
        });
        test('should not get the ecotaxa_account if it does not exist', async () => {
            const ecotaxa_account = await dataSource_EcotaxaAccount.getOne(100);

            expect(ecotaxa_account).toEqual(null);
        });
    });
    // describe('getAll', () => {
    //     test('should get all the ecotaxa_account', async () => {
    //         const ecotaxa_accounts = await dataSource_EcotaxaAccount.getAll();

    //         expect(ecotaxa_accounts).toBeDefined();
    //         expect(ecotaxa_accounts).toHaveLength(1);
    //         // to be equal exept creation date
    //         expect(ecotaxa_accounts[0]).toMatchObject({
    //             ...ecotaxaAccountResponseModel_lena,
    //             ecotaxa_account_creation_date: expect.any(String)
    //         });
    //     });
    // });
    describe('deleteOne', () => {
        test('should not delete the ecotaxa_account if ecopart user id doesnt match the account id', async () => {
            const ecotaxaAccount = {
                ecotaxa_account_id: 1,
                ecotaxa_account_ecopart_user_id: 2
            }
            const ecotaxa_accountId = await dataSource_EcotaxaAccount.deleteOne(ecotaxaAccount);

            expect(ecotaxa_accountId).toEqual(0);
        });
        test('should not delete the ecotaxa_account if it does not exist', async () => {
            const ecotaxaAccount = {
                ecotaxa_account_id: 100,
                ecotaxa_account_ecopart_user_id: 1
            }
            const ecotaxa_accountId = await dataSource_EcotaxaAccount.deleteOne(ecotaxaAccount);

            expect(ecotaxa_accountId).toEqual(0);
        });
        test('should delete the ecotaxa_account', async () => {
            const ecotaxaAccount = {
                ecotaxa_account_id: 1,
                ecotaxa_account_ecopart_user_id: 1
            }
            const ecotaxa_accountId = await dataSource_EcotaxaAccount.deleteOne(ecotaxaAccount);

            expect(ecotaxa_accountId).toBeDefined();
            expect(ecotaxa_accountId).toEqual(1);
        });
    });
    describe('getOneEcoTaxaInstance', () => {
        test('should get the ecotaxa_instance', async () => {
            const ecotaxa_instance = await dataSource_EcotaxaAccount.getOneEcoTaxaInstance(1);

            expect(ecotaxa_instance).toBeDefined();
            expect(ecotaxa_instance).toMatchObject({
                ecotaxa_instance_id: 1,
                ecotaxa_instance_name: "FR",
                ecotaxa_instance_description: "French instance of EcoTaxa, can be used world wilde.",
                ecotaxa_instance_url: "https://ecotaxa.obs-vlfr.fr/",
                ecotaxa_instance_creation_date: expect.any(String)
            });
        });
        test('should not get the ecotaxa_instance if it does not exist', async () => {
            const ecotaxa_instance = await dataSource_EcotaxaAccount.getOneEcoTaxaInstance(100);
            expect(ecotaxa_instance).toEqual(null);
        });
    });
});