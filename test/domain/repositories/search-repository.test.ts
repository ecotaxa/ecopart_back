import { SearchRepository } from "../../../src/domain/interfaces/repositories/search-repository";
import { SearchRepositoryImpl } from "../../../src/domain/repositories/search-repository";

describe("Search Repository", () => {

    let searchRepository: SearchRepository

    beforeEach(() => {
        jest.clearAllMocks();
        searchRepository = new SearchRepositoryImpl()
    })

    describe("formatSortBy", () => {
        test("Should return prepared sort by", () => {
            const raw_sort_by = "asc(field1),desc(field2)"
            const expected_sort_by = [
                { sort_by: "field1", order_by: "asc" },
                { sort_by: "field2", order_by: "desc" }
            ]
            const result = searchRepository.formatSortBy(raw_sort_by)
            expect(result).toStrictEqual(expected_sort_by)
        });
        test("Should throw error if sort_by is invalid", () => {
            const raw_sort_by = "asc(field1),desc"
            expect(() => searchRepository.formatSortBy(raw_sort_by)).toThrowError("Invalid sorting statement : 'desc'")
        });
        test("Should throw error if sort_by is invalid", () => {
            const raw_sort_by = "asc(field1),asc()"
            expect(() => searchRepository.formatSortBy(raw_sort_by)).toThrowError("Invalid sorting statement : 'asc()")
        });
        test("Should throw error if sort_by is invalid", () => {
            const raw_sort_by = "field1(asc)"
            expect(() => searchRepository.formatSortBy(raw_sort_by)).toThrowError("Invalid sorting statement : 'field1'")
        });
        test("Should throw error if sort_by is invalid (not asc or desc)", () => {
            const raw_sort_by = "acs(field1)"
            expect(() => searchRepository.formatSortBy(raw_sort_by)).toThrowError("Invalid sorting statement : 'acs'")
        });
    })

    describe("formatFilters", () => {
        test("Should return formatted filters", () => {
            const filters = [
                { field: "field1", operator: ">", value: 10 },
                { field: "field2", operator: "<", value: 10 },
                { field: "field2", operator: ">=", value: 10 },
                { field: "field2", operator: "<=", value: 10 },

                { field: "field3", operator: "IN", value: ["value1", "value2"] },
                { field: "field4", operator: "LIKE", value: "value%" },

                { field: "field5", operator: "=", value: "value5" },
                { field: "field5", operator: "<>", value: 34 },
                { field: "field5", operator: "<>", value: true },
            ]
            const result = searchRepository.formatFilters(filters)
            expect(result).toStrictEqual(filters)
        });
        test("Should throw error if operator is invalid", () => {
            const filters = [
                { field: "field1", operator: "toto", value: 10 }]
            expect(() => searchRepository.formatFilters(filters)).toThrowError("Invalid filter statement : 'Invalid operator in filter : [{\"field\":\"field1\",\"operator\":\"toto\",\"value\":10}]'")
        });
        test("Should throw error if value is invalid type", () => {
            const filters = [
                { field: "field1", operator: ">", value: "tt" },
                { field: "field2", operator: "<", value: true },
                { field: "field2", operator: ">=", value: [44] },
                { field: "field2", operator: "<=", value: ["10"] },

                { field: "field3", operator: "IN", value: "1,2" },
                { field: "field4", operator: "LIKE", value: 67 },

                { field: "field5", operator: "=", value: ["value5"] },
                { field: "field5", operator: "<>", value: [34] },
            ]
            expect(() => searchRepository.formatFilters(filters)).toThrowError("Invalid filter statement : 'Value for operator > must be type of number: {\"field\":\"field1\",\"operator\":\">\",\"value\":\"tt\"}, Value for operator < must be type of number: {\"field\":\"field2\",\"operator\":\"<\",\"value\":true}, Value for operator >= must be type of number: {\"field\":\"field2\",\"operator\":\">=\",\"value\":[44]}, Value for operator <= must be type of number: {\"field\":\"field2\",\"operator\":\"<=\",\"value\":[\"10\"]}, Value for operator 'IN' must be an array in filter: {\"field\":\"field3\",\"operator\":\"IN\",\"value\":\"1,2\"}, Value for operator 'LIKE' must be a string in filter: {\"field\":\"field4\",\"operator\":\"LIKE\",\"value\":67}, Value for operator = must be type of string or number or boolean: {\"field\":\"field5\",\"operator\":\"=\",\"value\":[\"value5\"]}, Value for operator <> must be type of string or number or boolean: {\"field\":\"field5\",\"operator\":\"<>\",\"value\":[34]}'")
        });
        test("Should throw error if filter is missing field, operator or value", () => {
            const filters = [
                { field: "field1", operator: ">", value: 10 },
                { field: "field2", operator: "<" },
                { field: "field2", value: 10 },
                { operator: "<", }
            ]
            expect(() => searchRepository.formatFilters(filters as any)).toThrowError("Invalid filter statement : 'Missing field, operator, or value in filter: {\"field\":\"field2\",\"operator\":\"<\"}, Missing field, operator, or value in filter: {\"field\":\"field2\",\"value\":10}, Missing field, operator, or value in filter: {\"operator\":\"<\"}'")

        });
    });
});