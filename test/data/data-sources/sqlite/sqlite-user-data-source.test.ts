import { SQLiteUserDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-user-data-source'
import sqlite3 from 'sqlite3'
import 'dotenv/config'
import { UserRequesCreationtModel, UserUpdateModel } from '../../../../src/domain/entities/user';
import fs from 'fs';

const config = {
    TEST_DBSOURCE: process.env.TEST_DBSOURCE || '',
}

function initializeUserDB() {
    const db = new sqlite3.Database(config.TEST_DBSOURCE, (err) => {
        if (err) {
            // Cannot open database
            console.error(err.message)
            throw err
        }
    });
    return new SQLiteUserDataSource(db)
}

function cleanUserDB() {
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

describe('SQLiteUserDataSource', () => {
    let dataSource: SQLiteUserDataSource;



    beforeAll(() => {
        dataSource = initializeUserDB();
    });

    afterAll(() => {
        cleanUserDB();
    });

    describe('create', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });

        test('should create a new user', async () => {
            const user: UserRequesCreationtModel = {
                first_name: 'Joan',
                last_name: 'dou',
                email: 'joan.dou@example.com',
                confirmation_code: '123456',
                password: 'hGUYGiu!5T',
                organisation: 'Organization',
                country: 'Country',
                user_planned_usage: 'Usage'
            };

            // Call the create method
            const userId = await dataSource.create(user);

            // Expect the user ID to be returned
            expect(userId).toBeDefined();
            // Expect the user ID to be returned
            expect(userId).toEqual(1);

        });

        test('should handle duplicate email', async () => {
            const user: UserRequesCreationtModel = {
                first_name: 'John',
                last_name: 'Doe',
                email: 'john.doe@example.com',
                confirmation_code: '123456',
                password: 'hGUYGiu!5T',
                organisation: 'Organization',
                country: 'Country',
                user_planned_usage: 'Usage'
            };
            // Test handling duplicate email
            const userId = await dataSource.create(user)
            // Expect the user ID to be returned
            expect(userId).toBeDefined();
            // Expect the user ID to be returned
            expect(userId).toEqual(2);

            await expect(dataSource.create(user)).rejects.toThrow();
        });
    });
    describe('getAll', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });

        test('should return all users', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [] });

            // Expect the user ID to be returned
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
        });
        test('should return all users with pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 1, filter: [], sort_by: [] });

            // Expect the user ID to be returned
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.users.length).toEqual(1);
        });
        test('should return all users with filtering', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'email', operator: 'LIKE', value: 'joan%' }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(1);
            expect(getAllOutput.users.length).toEqual(1);
            expect(getAllOutput.users[0].email).toEqual('joan.dou@example.com');
        });
        test('should return all users with filtering', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'email', operator: 'LIKE', value: 'jo%' }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.users.length).toEqual(2);
            expect(getAllOutput.users[0].email).toEqual('joan.dou@example.com');
            expect(getAllOutput.users[1].email).toEqual('john.doe@example.com');
        });
        test('should return all users with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'email', order_by: 'ASC' }] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.users.length).toEqual(2);
            expect(getAllOutput.users[0].email).toEqual('joan.dou@example.com');
        });
        test('should return all users with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'email', order_by: 'DESC' }] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.users.length).toEqual(2);
            expect(getAllOutput.users[0].email).toEqual('john.doe@example.com');
        });
        test('should return all users with sorting and filtering', async () => {
            // Add bunch of users
            const user3: UserRequesCreationtModel = {
                first_name: 'Alice',
                last_name: 'Smith',
                email: 'alice@example.com',
                confirmation_code: '123456',
                password: 'hGUYGiu!5T',
                organisation: 'Organization',
                country: 'Country',
                user_planned_usage: 'Usage'
            };
            const user4: UserRequesCreationtModel = {
                first_name: 'Marc',
                last_name: 'smith',
                email: 'marc@example.com',
                confirmation_code: '123456',
                password: 'hGUYGiu!5T',
                organisation: 'Organization',
                country: 'Country',
                user_planned_usage: 'Usage'
            };
            const user5: UserRequesCreationtModel = {
                first_name: 'Julie',
                last_name: 'Doe',
                email: 'julie.doe@example.com',
                confirmation_code: '123456',
                password: 'hGUYGiu!5T',
                organisation: 'LOV',
                country: 'Country',
                user_planned_usage: 'Usage'
            };
            await dataSource.create(user3)
            await dataSource.create(user4)
            await dataSource.create(user5)


            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'organisation', operator: '=', value: 'Organization' }], sort_by: [{ sort_by: 'email', order_by: 'ASC' }] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(4);
            expect(getAllOutput.users.length).toEqual(4);
            expect(getAllOutput.users[0].email).toEqual('alice@example.com');
            expect(getAllOutput.users[1].email).toEqual('joan.dou@example.com');
            expect(getAllOutput.users[2].email).toEqual('john.doe@example.com');
            expect(getAllOutput.users[3].email).toEqual('marc@example.com');

        });

        test('should return all users with sorting and filtering and pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 2, limit: 2, filter: [{ field: 'organisation', operator: '=', value: 'Organization' }], sort_by: [{ sort_by: 'user_id', order_by: 'DESC' }] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(4);
            expect(getAllOutput.users.length).toEqual(2);
            expect(getAllOutput.users[0].email).toEqual('john.doe@example.com');
            expect(getAllOutput.users[1].email).toEqual('joan.dou@example.com');
        });

        test('should return all users with sorting and filtering and pagination IN', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'organisation', operator: 'IN', value: ['Organization', 'LOV'] }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(5);
            expect(getAllOutput.users.length).toEqual(5);
        });
        test('should return all users with sorting and filtering and pagination true', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'valid_email', operator: '=', value: true }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(0);
            expect(getAllOutput.users.length).toEqual(0);
        });
        test('should return all users with sorting and filtering and pagination false', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'valid_email', operator: '=', value: false }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(5);
            expect(getAllOutput.users.length).toEqual(5);
        });
        test('should return all users with sorting and filtering and pagination null', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'deleted', operator: '=', value: null }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(5);
            expect(getAllOutput.users.length).toEqual(5);
        });
        test('should return all users with sorting and filtering and pagination null', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'deleted', operator: '!=', value: null }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(0);
            expect(getAllOutput.users.length).toEqual(0);
        });

    });

    describe('updateOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('should update a user', async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                first_name: 'EDITED',
                last_name: 'EDITED',
                valid_email: true
            }
            // Call the updateOne method
            const updated = await dataSource.updateOne(user_to_update);

            // Expect the NUMBER of updated rows to be returned
            expect(updated).toBeDefined();
            expect(updated).toEqual(1);
            // Call the getAll method where the user is updated
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'user_id', operator: '=', value: 2 }], sort_by: [] });
            expect(getAllOutput.users).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(1);
            expect(getAllOutput.users.length).toEqual(1);
            expect(getAllOutput.users[0].first_name).toEqual('EDITED');
            expect(getAllOutput.users[0].last_name).toEqual('EDITED');
            expect(getAllOutput.users[0].valid_email).toEqual(true);
        });
    });

    describe('getOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('get one by user_id : no matchs', async () => {
            // Call the getOne method
            const user = await dataSource.getOne({ user_id: 5678 });
            expect(user).toBeDefined();
            // not null
            expect(user).toBeNull();
        });
        test('get one by user_id', async () => {
            const user_by_id = {
                confirmation_code: "123456",
                country: "Country",
                deleted: null,
                email: "john.doe@example.com",
                first_name: "EDITED",
                is_admin: false,
                last_name: "EDITED",
                organisation: "Organization",
                reset_password_code: null,
                user_creation_date: "2024-03-04 17:02:02",
                user_id: 2,
                user_planned_usage: "Usage",
                valid_email: true,
            }
            // Call the getOne method
            const user = await dataSource.getOne({ user_id: 2 });
            expect(user).toBeDefined();
            // not null
            expect(user).not.toBeNull();
            if (user) {
                // Compare each property individually, excluding the user_creation_date
                expect(user.confirmation_code).toEqual(user_by_id.confirmation_code);
                expect(user.country).toEqual(user_by_id.country);
                expect(user.deleted).toEqual(user_by_id.deleted);
                expect(user.email).toEqual(user_by_id.email);
                expect(user.first_name).toEqual(user_by_id.first_name);
                expect(user.is_admin).toEqual(user_by_id.is_admin);
                expect(user.last_name).toEqual(user_by_id.last_name);
                expect(user.organisation).toEqual(user_by_id.organisation);
                expect(user.reset_password_code).toEqual(user_by_id.reset_password_code);
                expect(user.user_id).toEqual(user_by_id.user_id);
                expect(user.user_planned_usage).toEqual(user_by_id.user_planned_usage);
                expect(user.valid_email).toEqual(user_by_id.valid_email);

                // Check for additional keys
                const userKeys = Object.keys(user);
                const userByIdKeys = Object.keys(user_by_id);
                const additionalKeys = userKeys.filter(key => !userByIdKeys.includes(key));
                expect(additionalKeys).toHaveLength(0);
            }
        });
        test('get one by email', async () => {
            const user_by_id = {
                confirmation_code: "123456",
                country: "Country",
                deleted: null,
                email: "john.doe@example.com",
                first_name: "EDITED",
                is_admin: false,
                last_name: "EDITED",
                organisation: "Organization",
                reset_password_code: null,
                user_creation_date: "2024-03-04 17:02:02",
                user_id: 2,
                user_planned_usage: "Usage",
                valid_email: true,
            }
            // Call the getOne method
            const user = await dataSource.getOne({ email: "john.doe@example.com" });
            expect(user).toBeDefined();
            // not null
            expect(user).not.toBeNull();
            if (user) {
                // Compare each property individually, excluding the user_creation_date
                expect(user.confirmation_code).toEqual(user_by_id.confirmation_code);
                expect(user.country).toEqual(user_by_id.country);
                expect(user.deleted).toEqual(user_by_id.deleted);
                expect(user.email).toEqual(user_by_id.email);
                expect(user.first_name).toEqual(user_by_id.first_name);
                expect(user.is_admin).toEqual(user_by_id.is_admin);
                expect(user.last_name).toEqual(user_by_id.last_name);
                expect(user.organisation).toEqual(user_by_id.organisation);
                expect(user.reset_password_code).toEqual(user_by_id.reset_password_code);
                expect(user.user_id).toEqual(user_by_id.user_id);
                expect(user.user_planned_usage).toEqual(user_by_id.user_planned_usage);
                expect(user.valid_email).toEqual(user_by_id.valid_email);

                // Check for additional keys
                const userKeys = Object.keys(user);
                const userByIdKeys = Object.keys(user_by_id);
                const additionalKeys = userKeys.filter(key => !userByIdKeys.includes(key));
                expect(additionalKeys).toHaveLength(0);
            }
        });
    });

    describe('getUserLogin', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('getUserLogin doesnt match', async () => {
            const email = ""
            const credentials = await dataSource.getUserLogin(email);
            expect(credentials).toBeDefined();
            expect(credentials).toBeNull();
        });
        test('getUserLogin match', async () => {
            const email = "john.doe@example.com"
            const credentials = await dataSource.getUserLogin(email);
            expect(credentials).toBeDefined();
            expect(credentials).toEqual({ "email": "john.doe@example.com", "password": "hGUYGiu!5T" })
        });
    });


});