import { SQLiteUserDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-user-data-source'
import { SQLiteDatabaseWrapper } from '../../../../src/data/interfaces/data-sources/database-wrapper';
import { UserRequesCreationtModel, UserResponseModel } from '../../../../src/domain/entities/user';

// TODO COMPLETE TESTS 
describe("PG DataSource", () => {

    let mockDatabase: SQLiteDatabaseWrapper

    beforeAll(async () => {
        mockDatabase = {
            all: jest.fn(),
            run: jest.fn(),
            get: jest.fn(),

        }
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    // TODO : AUTO ID
    test("getAll", async () => {
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const DbOutputData = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: 0,
            valid_email: 1,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const ds = new SQLiteUserDataSource(mockDatabase);
        jest.spyOn(mockDatabase, "all").mockImplementation(() => Promise.resolve({ rows: [{ name: "Smith", user_id: "123" }] }))
        const result = await ds.getAll();
        expect(mockDatabase.all).toHaveBeenCalledWith("SELECT * FROM user")
        expect(result).toStrictEqual([OutputData])
    })

    // TODO
    test("create", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }

        const ds = new SQLiteUserDataSource(mockDatabase);
        const inputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "123test!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }
        await ds.create(inputData);
        expect(mockDatabase.run).toHaveBeenCalledWith("INSERT INTO user (name) VALUES ($1)", ["Smith"])
    })

    // test("deleteOne", async () => {
    //     const ds = new SQLiteUserDataSource(mockDatabase);
    //     await ds.deleteOne("1");
    //     expect(mockDatabase.query).toHaveBeenCalledWith("delete tb_user where user_id = $1", ["1"])
    // })

    // test("updateOne", async () => {
    //     const ds = new SQLiteUserDataSource(mockDatabase);
    //     await ds.updateOne("1", { name: "Ramon" });
    //     expect(mockDatabase.query).toHaveBeenCalledWith("update tb_user set name = $1 where user_id = $2", ["Ramon", "1"])
    // })

    // test("getOne", async () => {
    //     const ds = new SQLiteUserDataSource(mockDatabase);
    //     jest.spyOn(mockDatabase, "query").mockImplementation(() => Promise.resolve({ rows: [{ user_id: "123", name: "Smith", }] }))
    //     const result = await ds.getOne("123");
    //     expect(result).toStrictEqual({ name: "Smith", user_id: "123" })
    //     expect(mockDatabase.query).toHaveBeenCalledWith("select * from tb_user where user_id = $1 limit 1", ["123"])
    // })

})