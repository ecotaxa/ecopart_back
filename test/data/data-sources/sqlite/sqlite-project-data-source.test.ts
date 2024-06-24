import { SQLiteProjectDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-project-data-source'
import sqlite3 from 'sqlite3'
import 'dotenv/config'
import { ProjectRequestCreationModel, ProjectUpdateModel } from '../../../../src/domain/entities/project';
import fs from 'fs';
import { projectRequestCreationModel_2, projectRequestCreationModel_3, projectRequestCreationModel_4, projectRequestCreationModel_5, projectRequestCreationModel_6, projectUpdateModel } from '../../../entities/project';

const config = {
    TEST_DBSOURCE: process.env.TEST_DBSOURCE || '',
}

function initializeProjectDB() {
    const db = new sqlite3.Database(config.TEST_DBSOURCE, (err) => {
        if (err) {
            // Cannot open database
            console.error(err.message)
            throw err
        }
    });
    return new SQLiteProjectDataSource(db)
}

function cleanProjectDB() {
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

describe('SQLiteProjectDataSource', () => {
    let dataSource: SQLiteProjectDataSource;



    beforeAll(() => {
        dataSource = initializeProjectDB();
    });

    afterAll(() => {
        cleanProjectDB();
    });

    describe('create', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });

        test('should create a new project', async () => {
            const project: ProjectRequestCreationModel = projectRequestCreationModel_2

            // Call the create method
            const projectId = await dataSource.create(project);

            // Expect the project ID to be returned
            expect(projectId).toBeDefined();
            // Expect the project ID to be returned
            expect(projectId).toEqual(1);

        });
        test('should create a new project', async () => {
            const project: ProjectRequestCreationModel = projectRequestCreationModel_3

            // Call the create method
            const projectId = await dataSource.create(project);

            // Expect the project ID to be returned
            expect(projectId).toBeDefined();
            // Expect the project ID to be returned
            expect(projectId).toEqual(2);

        });

    });
    describe('getAll', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });

        test('should return all projects', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [] });

            // Expect the project ID to be returned
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
        });
        test('should return all projects with pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 1, filter: [], sort_by: [] });

            // Expect the project ID to be returned
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(1);
        });
        test('should return all projects with filtering', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'project_title', operator: 'LIKE', value: 'joan%' }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(1);
            expect(getAllOutput.items.length).toEqual(1);
            expect(getAllOutput.items[0].project_title).toEqual('joan project_title');
        });
        test('should return all projects with filtering', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'project_title', operator: 'LIKE', value: 'jo%' }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].project_title).toEqual('joan project_title');
            expect(getAllOutput.items[1].project_title).toEqual('john project_title');
        });
        test('should return all projects with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'project_title', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].project_title).toEqual('joan project_title');
        });
        test('should return all projects with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'project_title', order_by: 'DESC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].project_title).toEqual('john project_title');
        });

        test('should return all projects with sorting and filtering', async () => {
            // Add bunch of projects
            const project3: ProjectRequestCreationModel = projectRequestCreationModel_4
            const project4: ProjectRequestCreationModel = projectRequestCreationModel_5
            const project5: ProjectRequestCreationModel = projectRequestCreationModel_6
            await dataSource.create(project3)
            await dataSource.create(project4)
            await dataSource.create(project5)


            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'instrument_model', operator: '=', value: 1 }], sort_by: [{ sort_by: 'project_title', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(4);
            expect(getAllOutput.items.length).toEqual(4);
            expect(getAllOutput.items[0].project_title).toEqual('alice project_title');
            expect(getAllOutput.items[1].project_title).toEqual('joan project_title');
            expect(getAllOutput.items[2].project_title).toEqual('john project_title');
            expect(getAllOutput.items[3].project_title).toEqual('marc project_title');

        });

        test('should return all projects with sorting and filtering and pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 2, limit: 2, filter: [{ field: 'instrument_model', operator: '=', value: 1 }], sort_by: [{ sort_by: 'project_id', order_by: 'DESC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(4);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].project_title).toEqual('john project_title');
            expect(getAllOutput.items[1].project_title).toEqual('joan project_title');
        });

        test('should return all projects with sorting and filtering and pagination IN', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'instrument_model', operator: 'IN', value: [1, 2] }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(5);
            expect(getAllOutput.items.length).toEqual(5);
        });
        test('should return all projects with sorting and filtering and pagination true', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'enable_descent_filter', operator: '=', value: true }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(4);
            expect(getAllOutput.items.length).toEqual(4);
        });
        test('should return all projects with sorting and filtering and pagination false', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'enable_descent_filter', operator: '=', value: false }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(1);
            expect(getAllOutput.items.length).toEqual(1);
        });
    });

    describe('updateOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('should update a project', async () => {
            const project_to_update: ProjectUpdateModel = projectUpdateModel
            // Call the updateOne method
            const updated = await dataSource.updateOne(project_to_update);

            // Expect the NUMBER of updated rows to be returned
            expect(updated).toBeDefined();
            expect(updated).toEqual(1);
            // Call the getAll method where the project is updated
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'project_id', operator: '=', value: 1 }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(1);
            expect(getAllOutput.items.length).toEqual(1);
            expect(getAllOutput.items[0].operator_email).toEqual("edited_user@email.com");
            expect(getAllOutput.items[0].operator_name).toEqual("Edited name");
        });
    });

    describe('getOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('get one by project_id : no matchs', async () => {
            // Call the getOne method
            const project = await dataSource.getOne({ project_id: 5678 });
            expect(project).toBeDefined();
            // not null
            expect(project).toBeNull();
        });
        test('get one by project_id', async () => {
            const project_by_id = { ...projectRequestCreationModel_3, project_id: 2 }
            // Call the getOne method
            const project = await dataSource.getOne({ project_id: 2 });
            expect(project).toBeDefined();
            // not null
            expect(project).not.toBeNull();
            if (project) {
                // Compare each property individually, excluding the project_creation_date

                expect(project.project_id).toEqual(project_by_id.project_id);
                expect(project.project_title).toEqual(project_by_id.project_title);
                expect(project.project_acronym).toEqual(project_by_id.project_acronym);
                expect(project.project_description).toEqual(project_by_id.project_description);
                expect(project.project_information).toEqual(project_by_id.project_information);
                expect(project.cruise).toEqual(project_by_id.cruise);
                expect(project.ship).toEqual(project_by_id.ship);
                expect(project.data_owner_name).toEqual(project_by_id.data_owner_name);
                expect(project.data_owner_email).toEqual(project_by_id.data_owner_email);
                expect(project.operator_name).toEqual(project_by_id.operator_name);
                expect(project.operator_email).toEqual(project_by_id.operator_email);
                expect(project.chief_scientist_name).toEqual(project_by_id.chief_scientist_name);
                expect(project.chief_scientist_email).toEqual(project_by_id.chief_scientist_email);
                expect(project.enable_descent_filter).toEqual(project_by_id.enable_descent_filter);
                expect(project.privacy_duration).toEqual(project_by_id.privacy_duration);
                expect(project.visible_duration).toEqual(project_by_id.visible_duration);
                expect(project.public_duration).toEqual(project_by_id.public_duration);
                expect(project.instrument_model).toEqual(project_by_id.instrument_model);
                expect(project.serial_number).toEqual(project_by_id.serial_number);


                // Check for additional keys
                const projectKeys = Object.keys(project);
                const projectByIdKeys = Object.keys(project_by_id);
                const additionalKeys = projectKeys.filter(key => !projectByIdKeys.includes(key));
                expect(additionalKeys).toHaveLength(1);
            }
        });
    });
    describe("Test delete one", () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('delete one by project_id : no matchs', async () => {
            // Call the deleteOne method
            const deleted = await dataSource.deleteOne({ project_id: 5678 });
            expect(deleted).toBeDefined();
            // not null
            expect(deleted).toEqual(0);
        });
        test('delete one by project_id', async () => {
            // Call the deleteOne method
            const deleted = await dataSource.deleteOne({ project_id: 1 });
            expect(deleted).toBeDefined();
            // not null
            expect(deleted).toEqual(1);
        });
    })

});