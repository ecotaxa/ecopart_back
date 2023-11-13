import { SQLiteUserDataSource } from '../../../../src/data/data-sources/sqlite/sqlite-user-data-source'
import { DatabaseWrapper } from '../../../../src/data/interfaces/data-sources/database-wrapper';

// TODO COMPLETE TESTS 
describe("PG DataSource", () => {

    let mockDatabase: DatabaseWrapper

    beforeAll(async () => {
        mockDatabase = {
            all: jest.fn(),
            run: jest.fn()
        }
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    // TODO : AUTO ID
    test("getAll", async () => {
        const ds = new SQLiteUserDataSource(mockDatabase);
        jest.spyOn(mockDatabase, "all").mockImplementation(() => Promise.resolve({ rows: [{ name: "Smith", user_id: "123" }] }))
        const result = await ds.getAll();
        expect(mockDatabase.all).toHaveBeenCalledWith("SELECT * FROM user")
        expect(result).toStrictEqual([{ name: "Smith", user_id: "123" }])
    })

    // TODO
    test("create", async () => {
        const ds = new SQLiteUserDataSource(mockDatabase);
        await ds.create({ name: "Smith", });
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