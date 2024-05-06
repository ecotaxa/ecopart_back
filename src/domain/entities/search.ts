// Raw data
export interface SearchOptions extends PaginedSearchOptions {
    filter?: FilterSearchOptions[]; // Add filtering support
    sort_by: PreparedSortingSearchOptions[] | string; // Add sorting support
}

export interface PaginedSearchOptions {
    page: number; // Pagination support, Default to page 1 if not specified
    limit: number; // Set limit for pagination, Default to 10 items per page if not specified
}

export interface FilterSearchOptions {
    field: string;
    operator: string; // DONE =, !=, >, >=, <, <=, IN, LIKE, // TODO BETWEEN, NOT BETWEEN  NOT LIKE,NOT IN,
    value: string | number | boolean | Date | null | undefined | any[];
}

// Prepared data
export interface PreparedSearchOptions extends PaginedSearchOptions {
    filter: FilterSearchOptions[];
    sort_by: PreparedSortingSearchOptions[];
}


export interface PreparedSortingSearchOptions {
    sort_by: string;
    order_by: string;
}

export interface SearchInfo {
    total: number; // Total number of items
    limit: number; // Items per page
    total_on_page: number; // Total number of items on current page
    page: number; // Current page
    pages: number; // Total number of pages
}
export interface SearchResult<T> {
    items: T[];
    total: number;
}
