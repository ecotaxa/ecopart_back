import { FilterSearchOptions, PreparedSortingSearchOptions, SearchInfo, SearchOptions, SearchResult } from "../../entities/search";

export interface SearchRepository {
    formatSearchInfo(result: SearchResult<any>, options: SearchOptions): SearchInfo;
    formatFilters(filters: FilterSearchOptions[]): FilterSearchOptions[];
    formatSortBy(sort_by: string): PreparedSortingSearchOptions[];
}