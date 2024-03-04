
import { SearchRepository } from "../interfaces/repositories/search-repository";
import { FilterSearchOptions, PreparedSortingSearchOptions } from "../entities/search";

export class SearchRepositoryImpl implements SearchRepository {
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    constructor() {
    }

    formatSortBy(raw_sort_by: string): PreparedSortingSearchOptions[] {
        // Array to store error messages
        const errors: string[] = [];

        // Split the raw_sort_by string by commas to get individual sorting statements
        const prepared_sort_by = raw_sort_by.split(",").map(statement => {
            // Split each statement by "(" to separate order_by and sort_by
            const [order_by, sort_by] = statement.split("(");

            // Check if sort_by or order_by is missing or if sort_by doesn't end with ")"
            if (!sort_by || sort_by.slice(-1) !== ")") {
                // Add an error message to the errors array
                errors.push(statement);
                console.log("error" + statement)
                return null;
            }

            // Extract the sort_by string and convert it to lowercase
            const clean_sort_by = sort_by.slice(0, -1).toLowerCase();

            // Check if clean_sort_by or order_by is empty
            if (!clean_sort_by || !order_by) {
                // Add an error message to the errors array
                errors.push(statement);
                console.log("error" + statement)

                return null;
            }

            // Return an object with sort_by and order_by keys
            return { sort_by: clean_sort_by, order_by: order_by.toLowerCase() };
        }).filter(Boolean); // Filter out null values

        // If there are errors, throw an error containing all error messages
        if (errors.length > 0) {
            throw new Error(`Invalid sorting statement : '${errors.join(', ')}'`);
        }

        // Return the prepared_sort_by array
        return prepared_sort_by as PreparedSortingSearchOptions[];
    }

    formatFilters(filters: FilterSearchOptions[]): FilterSearchOptions[] {
        const errors: string[] = [];

        // Filter out filters that do not have field, operator, and value
        const formatted_filters = filters.filter(filter => {
            if (!filter.field || !filter.operator || filter.value === undefined) {
                errors.push(`Missing field, operator, or value in filter: ${JSON.stringify(filter)}`);
                return false;
            }
            return true;
        });

        // Check specific conditions for certain operators
        formatted_filters.filter(filter => {
            // If filters not in the list of filter_operator_allow_params
            if (!this.filter_operator_allow_params.includes(filter.operator)) {
                errors.push(`Invalid operator in filter : ${JSON.stringify(formatted_filters)}`);
                return false;
            }
            else if (filter.operator === "IN" && !Array.isArray(filter.value)) {
                errors.push(`Value for operator 'IN' must be an array in filter: ${JSON.stringify(filter)}`);
                return false;
            }
            else if (filter.operator === "LIKE" && typeof filter.value !== "string") {
                errors.push(`Value for operator 'LIKE' must be a string in filter: ${JSON.stringify(filter)}`);
                return false;
            }
            else if ([">", "<", ">=", "<="].includes(filter.operator) && typeof filter.value !== "number") {
                errors.push(`Value for operator ${filter.operator} must be type of number: ${JSON.stringify(filter)}`);
                return false;
            }
            else if (["=", "<>"].includes(filter.operator) && !(typeof filter.value === "string" || typeof filter.value === "number" || typeof filter.value === "boolean")) {
                errors.push(`Value for operator ${filter.operator} must be type of string or number or boolean: ${JSON.stringify(filter)}`);
                return false;
            }
            else {
                return true;
            }
        });

        // If there are errors, throw an error containing all error messages
        if (errors.length > 0) {
            throw new Error(`Invalid filter statement : '${errors.join(', ')}'`);
        }
        return formatted_filters;
    }


}