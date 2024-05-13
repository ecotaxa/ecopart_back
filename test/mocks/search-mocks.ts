import { SearchRepository } from "../../src/domain/interfaces/repositories/search-repository";

export class MockSearchRepository implements SearchRepository {
    formatFilters(): any {
        throw new Error("Method not implemented : formatFilters");
    }
    formatSortBy(): any {
        throw new Error("Method not implemented : formatSortBy");
    }
}