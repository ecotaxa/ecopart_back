
import { SQLiteInstrumentModelDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-instrument_model-data-source'
import sqlite3 from 'sqlite3'
import fs from 'fs';

const config = {
    TEST_DBSOURCE: 'TEST_DB_SOURCE_INSTRUMENT_MODEL'
}

function initializeInstrumentModelDB() {
    const db = new sqlite3.Database(config.TEST_DBSOURCE, (err) => {
        if (err) {
            // Cannot open database
            console.error(err.message)
            throw err
        }
    });
    // Enable foreign keys in sqlite
    db.get("PRAGMA foreign_keys = ON")

    return new SQLiteInstrumentModelDataSource(db)

}

function cleanInstrumentModelDB() {
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

describe('SQLiteInstrumentModelDataSource', () => {
    let dataSource: SQLiteInstrumentModelDataSource;

    beforeAll(() => {
        dataSource = initializeInstrumentModelDB();
    });

    afterAll(() => {
        cleanInstrumentModelDB();
    });

    describe('init', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });

        // instruments should be automatically created when the db is initialized
        //                const sql_admin = "INSERT OR IGNORE INTO instrument_model (instrument_model_name, bodc_url) VALUES ('UVP5HD', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/'), ('UVP5SD', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/'), ('UVP5Z', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1577/'), ('UVP6LP', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/'), ('UVP6HF', 'https://vocab.nerc.ac.uk/collection/L22/current/TOOL1578/'), ('UVP6MHP','Not registred in BODC for now'), ('UVP6MHF', 'Not registred in BODC for now');"
        test('instruments should have been  created when the db was initialized', async () => {
            // Call the getAll method sorted by id
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'instrument_model_id', order_by: 'ASC' }] });

            // Expect the instrument_model ID to be returned
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.items.length).toEqual(7);
            // expect instruments names
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP5HD');
            expect(getAllOutput.items[1].instrument_model_name).toEqual('UVP5SD');
            expect(getAllOutput.items[2].instrument_model_name).toEqual('UVP5Z');
            expect(getAllOutput.items[3].instrument_model_name).toEqual('UVP6LP');
            expect(getAllOutput.items[4].instrument_model_name).toEqual('UVP6HF');
            expect(getAllOutput.items[5].instrument_model_name).toEqual('UVP6MHP');
            expect(getAllOutput.items[6].instrument_model_name).toEqual('UVP6MHF');
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(7);
        })
    });

    describe('create', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });

        test('should create a instrument_model', async () => {
            // Call the create method
            const instrument_model_id = await dataSource.create({ instrument_model_name: 'UVP7HD', bodc_url: 'http://uvp7hd.com' });
            console.log(instrument_model_id)
            // Expect the instrument_model ID to be returned
            expect(instrument_model_id).toBeDefined();
            expect(instrument_model_id).toEqual(8);
        });

        test('should not create a instrument_model with the same name', async () => {
            try {
                // Call the create method
                await dataSource.create({ instrument_model_name: 'UVP7HD', bodc_url: 'http://uvp7hd.com' });
            } catch (error) {
                // expected error message
                expect(error.message).toEqual('SQLITE_CONSTRAINT: UNIQUE constraint failed: instrument_model.instrument_model_name');
            }
        });
    });

    describe('getAll', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('should return all instrument_models', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [] });

            // Expect the instrument_model ID to be returned
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(8);
        });
        test('should return all instrument_models with pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 1, filter: [], sort_by: [] });

            // Expect the instrument_model ID to be returned
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(8);
            expect(getAllOutput.items.length).toEqual(1);
        });
        test('should return all instrument_models with filtering', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'instrument_model_name', operator: 'LIKE', value: 'UVP5%' }], sort_by: [{ sort_by: 'instrument_model_id', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(3);
            expect(getAllOutput.items.length).toEqual(3);
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP5HD');
        });
        test('should return all instrument_models with filtering on not null', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'instrument_model_name', operator: '!=', value: 'null' }], sort_by: [{ sort_by: 'instrument_model_id', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(8);
            expect(getAllOutput.items.length).toEqual(8);
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP5HD');
        });
        test('should return all instrument_models with filtering on null', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [{ field: 'instrument_model_name', operator: '=', value: 'null' }], sort_by: [] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(0);
            expect(getAllOutput.items.length).toEqual(0);
        });
        test('should return all instrument_models with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'instrument_model_name', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(8);
            expect(getAllOutput.items.length).toEqual(8);
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP5HD');
        });
        test('should return all instrument_models with sorting', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 10, filter: [], sort_by: [{ sort_by: 'instrument_model_name', order_by: 'DESC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(8);
            expect(getAllOutput.items.length).toEqual(8);
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP7HD');
        });

        test('should return all instrument_models with sorting filtering and pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 2, filter: [{ field: 'instrument_model_name', operator: 'LIKE', value: 'UVP5%' }], sort_by: [{ sort_by: 'instrument_model_creation_date', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(3);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP5HD');
            expect(getAllOutput.items[1].instrument_model_name).toEqual('UVP5SD');
        });
        test('should return all instrument_models with sorting filtering and pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 2, filter: [{ field: 'instrument_model_name', operator: '=', value: 'UVP5HD' }], sort_by: [{ sort_by: 'instrument_model_creation_date', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(1);
            expect(getAllOutput.items.length).toEqual(1);
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP5HD');
        });
        test('should return all instrument_models with sorting filtering and pagination', async () => {
            // Call the getAll method
            const getAllOutput = await dataSource.getAll({ page: 1, limit: 2, filter: [{ field: 'instrument_model_name', operator: 'IN', value: ['UVP5HD', 'UVP5SD'] }], sort_by: [{ sort_by: 'instrument_model_creation_date', order_by: 'ASC' }] });
            expect(getAllOutput.items).toBeDefined();
            expect(getAllOutput.total).toBeDefined();
            expect(getAllOutput.total).toEqual(2);
            expect(getAllOutput.items.length).toEqual(2);
            expect(getAllOutput.items[0].instrument_model_name).toEqual('UVP5HD');
            expect(getAllOutput.items[1].instrument_model_name).toEqual('UVP5SD');
        });

    });

    describe('updateOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('should update a instrument_model', async () => {
            // Call the updateOne method
            const updated = await dataSource.updateOne({ instrument_model_id: 8, instrument_model_name: 'UVP8', bodc_url: 'http://uvp8.com' });

            // Expect the NUMBER of updated rows to be returned
            expect(updated).toBeDefined();
            expect(updated).toEqual(1);
            // Call the getAll method where the instrument_model is updated
            const getAllOutput = await dataSource.getOne({ instrument_model_id: 8 });
            expect(getAllOutput).toBeDefined();
            expect(getAllOutput?.instrument_model_name).toEqual('UVP8');
            expect(getAllOutput?.bodc_url).toEqual('http://uvp8.com');
        });
        test('should not update a instrument_model with the same name', async () => {
            try {
                // Call the updateOne method
                await dataSource.updateOne({ instrument_model_id: 8, instrument_model_name: 'UVP5HD', bodc_url: 'http://uvp7hd.com' });
            } catch (error) {
                // expected error message
                expect(error.message).toEqual('SQLITE_CONSTRAINT: UNIQUE constraint failed: instrument_model.instrument_model_name');
            }
        });
    });
    describe('getOne', () => {
        test('init the db', async () => {
            // Test initializing the database
            expect(dataSource).toBeDefined();
        });
        test('get one by instrument_model_id : no matchs', async () => {
            // Call the getOne method
            const instrument_model = await dataSource.getOne({ instrument_model_id: 5678 });
            expect(instrument_model).toBeDefined();
            // not null
            expect(instrument_model).toBeNull();
        });
        test('get one by instrument_model_id', async () => {
            // Call the getOne method
            const instrument_model = await dataSource.getOne({ instrument_model_id: 8 });
            expect(instrument_model).toBeDefined();
            // not null
            expect(instrument_model).not.toBeNull();
            if (instrument_model) {
                // Compare each property individually, excluding the instrument_model_creation_date
                expect(instrument_model.instrument_model_id).toEqual(8);
                expect(instrument_model.instrument_model_name).toEqual('UVP8');
                expect(instrument_model.bodc_url).toEqual('http://uvp8.com');
            }
        });
        test('get one by instrument_model_id : no matchs', async () => {
            // Call the getOne method
            const instrument_model = await dataSource.getOne({ instrument_model_id: 5678 });
            expect(instrument_model).toBeDefined();
            expect(instrument_model).toBeNull();
        });
    });

});

