import { FilterSearchOptions, PreparedSortingSearchOptions } from "../../entities/search";

export interface SearchRepository {
    formatFilters(filters: FilterSearchOptions[]): FilterSearchOptions[];
    formatSortBy(sort_by: string): PreparedSortingSearchOptions[];
}