

import { SQLitePrivilegeDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-privilege-data-source';
import { SQLiteProjectDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-project-data-source';
import { SQLiteUserDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-user-data-source';
import { SQLiteInstrumentModelDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-instrument_model-data-source';

import sqlite3 from 'sqlite3'
import fs from 'fs';
import { userRequestCreationModel_1, userRequestCreationModel_2 } from '../../../entities/user';
import { projectRequestCreationModelForRepository } from '../../../entities/project';
import { PrivilegeRequestModel } from '../../../../src/domain/entities/privilege';

const config = {
    TEST_DBSOURCE: 'TEST_DB_SOURCE_PRIVILEGE'
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
function initializePrivilegeDB(db: sqlite3.Database) {
    return new SQLitePrivilegeDataSource(db)
}
function initializeProjectDB(db: sqlite3.Database) {
    return new SQLiteProjectDataSource(db)
}
function initializeUserDB(db: sqlite3.Database) {
    return new SQLiteUserDataSource(db)
}
function initializeInstrumentModelDB(db: sqlite3.Database) {
    return new SQLiteInstrumentModelDataSource(db)
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

describe('SQLitePrivilegeDataSource', () => {
    let db: sqlite3.Database;
    let dataSource_Privilege: SQLitePrivilegeDataSource;
    let dataSource_Project: SQLiteProjectDataSource;
    let dataSource_User: SQLiteUserDataSource;
    let dataSource_InstrumentModel: SQLiteInstrumentModelDataSource;

    beforeAll(() => {
        db = initializeDB();
        dataSource_Privilege = initializePrivilegeDB(db);
        dataSource_Project = initializeProjectDB(db);
        dataSource_User = initializeUserDB(db);
        dataSource_InstrumentModel = initializeInstrumentModelDB(db);
    });

    afterAll(() => {
        cleanDB();
    });

    describe('create', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource_Privilege).toBeDefined();
            expect(dataSource_Project).toBeDefined();
            expect(dataSource_User).toBeDefined();
            expect(dataSource_InstrumentModel).toBeDefined();
        });

        test('should create a privilege', async () => {

            const user_id = await dataSource_User.create(userRequestCreationModel_1)
            const project_id = await dataSource_Project.create(projectRequestCreationModelForRepository)
            // Call the create method
            //member or manager
            //user_id, project_id, privilege_name, contact
            const privilege_id = await dataSource_Privilege.create({ user_id: user_id, project_id: project_id, privilege_name: 'manager', contact: true });
            console.log(privilege_id)
            // Expect the privilege ID to be returned
            expect(privilege_id).toBeDefined();
            expect(privilege_id).toEqual(1);
        });

        test('should not create a privilege for an unknown user', async () => {
            try {
                // Call the create method with an unknown user_id
                await dataSource_Privilege.create({ user_id: 1234567899, project_id: 1, privilege_name: 'manager', contact: true });

                // If it doesn't throw, the test should fail
                expect(true).toBeFalsy();
            } catch (error) {
                // Log the error message to see what is being caught
                console.log('Caught error:', error.message);

                // If it throws, check the error message
                expect(error).toBeDefined();
                expect(error.message).toEqual('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed');
            }
        });


        test('should not create a privilege fo an unknown project', async () => {
            try {
                // Call the create method
                await dataSource_Privilege.create({ user_id: 1, project_id: 1234, privilege_name: 'manager', contact: true });
                expect(true).toBeFalsy();
            } catch (error) {
                // expected error message
                expect(error.message).toEqual('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed');
            }

        });
    });

    describe('deleteOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource_Privilege).toBeDefined();
            expect(dataSource_Project).toBeDefined();
            expect(dataSource_User).toBeDefined();
            expect(dataSource_InstrumentModel).toBeDefined();
        });

        test('should delete a privilege', async () => {
            // Call the deleteOne method
            const deleted = await dataSource_Privilege.deleteOne({ privilege_id: 1 });

            // Expect the NUMBER of deleted rows to be returned
            expect(deleted).toBeDefined();
            expect(deleted).toEqual(1);
        });

        test('should not delete a privilege that does not exist', async () => {
            // Call the deleteOne method
            const deleted = await dataSource_Privilege.deleteOne({ privilege_id: 1234 });

            // Expect the NUMBER of deleted rows to be returned
            expect(deleted).toBeDefined();
            expect(deleted).toEqual(0);
        });
    });

    describe('deleteAll', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource_Privilege).toBeDefined();
            expect(dataSource_Project).toBeDefined();
            expect(dataSource_User).toBeDefined();
            expect(dataSource_InstrumentModel).toBeDefined();
        });

        test('should delete all privileges for the given user_id', async () => {

            const project_id_1 = await dataSource_Project.create(projectRequestCreationModelForRepository)
            const project_id_2 = await dataSource_Project.create(projectRequestCreationModelForRepository)
            await dataSource_Privilege.create({ user_id: 1, project_id: project_id_1, privilege_name: 'manager', contact: true });
            await dataSource_Privilege.create({ user_id: 1, project_id: project_id_2, privilege_name: 'member', contact: false });

            // count how many privileges are in the database for user 1
            const privilegesBefore = await dataSource_Privilege.getAll({
                page: 1, limit: 10, filter: [{
                    field: 'user_id',
                    operator: '=',
                    value: 1
                }], sort_by: []
            });
            const numberOfPrivilegesBefore = privilegesBefore.total
            // Call the deleteAll method
            const privilege: PrivilegeRequestModel = { user_id: 1 }
            const deleted = await dataSource_Privilege.deleteAll(privilege);

            // Expect the NUMBER of deleted rows to be returned
            expect(deleted).toBeDefined();
            expect(deleted).toEqual(numberOfPrivilegesBefore);
        });

        test('should delete all privileges for the given project_id', async () => {

            await dataSource_Privilege.create({ user_id: 1, project_id: 1, privilege_name: 'manager', contact: true });

            // count how many privileges are in the database for project 1
            const privilegesBefore = await dataSource_Privilege.getAll({
                page: 1, limit: 10, filter: [{
                    field: 'project_id',
                    operator: '=',
                    value: 1
                }], sort_by: []
            });
            const numberOfPrivilegesBefore = privilegesBefore.total
            // Call the deleteAll method
            const privilege: PrivilegeRequestModel = { project_id: 1 }
            const deleted = await dataSource_Privilege.deleteAll(privilege);

            // Expect the NUMBER of deleted rows to be returned
            expect(deleted).toBeDefined();
            expect(deleted).toEqual(numberOfPrivilegesBefore);
        });
    });

    describe('getAll', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource_Privilege).toBeDefined();
            expect(dataSource_Project).toBeDefined();
            expect(dataSource_User).toBeDefined();
            expect(dataSource_InstrumentModel).toBeDefined();
        });

        test('should return all privileges', async () => {
            const project_id_1 = await dataSource_Project.create(projectRequestCreationModelForRepository)
            const project_id_2 = await dataSource_Project.create(projectRequestCreationModelForRepository)
            await dataSource_Privilege.create({ user_id: 1, project_id: project_id_1, privilege_name: 'manager', contact: true });
            await dataSource_Privilege.create({ user_id: 1, project_id: project_id_2, privilege_name: 'member', contact: false });

            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 10, filter: [], sort_by: [] });

            // Expect the privilege ID to be returned
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
        });

        test('should return all privileges with pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 1, filter: [], sort_by: [] });

            // Expect the privilege ID to be returned
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(1);
        });

        test('should return all privileges with filtering', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 10, filter: [{ field: 'privilege_name', operator: 'LIKE', value: 'manager' }], sort_by: [{ sort_by: 'privilege_id', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(1);
            expect(getAllOutput.items.length).toEqual(1);
            expect(getAllOutput.items[0].privilege_name).toEqual('manager');
        });

        test('should return all privileges with filtering on not null', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 10, filter: [{ field: 'privilege_name', operator: '!=', value: 'null' }], sort_by: [{ sort_by: 'privilege_id', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].privilege_name).toEqual('manager');
        });

        test('should return all privileges with filtering on null', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 10, filter: [{ field: 'user_id', operator: '=', value: 'null' }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(0);
            expect(getAllOutput.items.length).toEqual(0);
        });

        test('should return all privileges with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'project_id', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].project_id).toEqual(4);
        });

        test('should return all privileges with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'project_id', order_by: 'DESC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].project_id).toEqual(5);
        });

        test('should return all privileges with sorting filtering and pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource_Privilege.getAll({ page: 1, limit: 2, filter: [{ field: 'privilege_name', operator: 'LIKE', value: 'm%' }], sort_by: [{ sort_by: 'privilege_creation_date', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].privilege_name).toEqual('manager');
        });
    });

    describe('getOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource_Privilege).toBeDefined();
            expect(dataSource_Project).toBeDefined();
            expect(dataSource_User).toBeDefined();
            expect(dataSource_InstrumentModel).toBeDefined();
        });

        test('get one by privilege_id : no matchs', async () => {
            // Call the getOne method
            const privilege = await dataSource_Privilege.getOne({ privilege_id: 5678 });
            expect(privilege).toBeDefined();
            // not null
            expect(privilege).toBeNull();
        });

        test('get one by privilege_id', async () => {
            // create a privilege
            const user_id = await dataSource_User.create(userRequestCreationModel_2)
            const project_id = await dataSource_Project.create(projectRequestCreationModelForRepository)
            const privilege_id = await dataSource_Privilege.create({ user_id: user_id, project_id: project_id, privilege_name: 'manager', contact: true });
            // Call the getOne method
            const privilege = await dataSource_Privilege.getOne({ privilege_id: privilege_id });
            expect(privilege).toBeDefined();
            // not null
            expect(privilege).not.toBeNull();
            if (privilege) {
                // Compare each property individually, excluding the privilege_creation_date
                expect(privilege.privilege_id).toEqual(privilege_id);
                expect(privilege.privilege_name).toEqual('manager');
                expect(privilege.contact).toEqual(true);
                expect(privilege.user_id).toEqual(user_id);
                expect(privilege.project_id).toEqual(project_id);
            }
        });
    });
});

