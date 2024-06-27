import { SearchInfo } from "../../src/domain/entities/search";
import { SearchRepository } from "../../src/domain/interfaces/repositories/search-repository";

export class MockSearchRepository implements SearchRepository {
    formatSearchInfo(): SearchInfo {
        throw new Error("Method not implemented.");
    }
    formatFilters(): any {
        throw new Error("Method not implemented : formatFilters");
    }
    formatSortBy(): any {
        throw new Error("Method not implemented : formatSortBy");
    }
}