//import { UserRequestModel } from "./user";

import { UserResponseModel } from "./user";

export interface SearchOptions {
    // filter?: string; // Add filtering support
    // sort?: string; // Add sorting support
    page?: number; // Add pagination support, Default to page 1 if not specified
    limit?: number; // Set limit for pagination, Default to 10 items per page if not specified
}
export interface PreparedSearchOptions {
    // filter?: any;
    // sort?: any; // sorting support
    page: number; // pagination support, Default to page 1 if not specified
    limit: number; // Set limit for pagination, Default to 10 items per page if not specified
}
// export interface User_PreparedSearchOptions extends PreparedSearchOptions {
//     filter: UserRequestModel; // filtering support
// }
export interface SearchInfo {
    total: number; // total number of items
    limit: number; // items per page
    total_on_page: number; // total number of items on current page
    page: number; // current page
    pages: number; // total number of pages
}

export interface SearchResult {
    users: UserResponseModel[],
    total: number
} 