import { PrivilegeRequestCreationModel, PrivilegeRequestModel, PrivilegeResponseModel } from "../../../domain/entities/privilege";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface PrivilegeDataSource {
    create(privilege: PrivilegeRequestCreationModel): Promise<number>;
    deleteOne(privilege: PrivilegeRequestModel): Promise<number>;
    deleteAll(privilege: PrivilegeRequestModel): Promise<number>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<PrivilegeResponseModel>>;
    getOne(privilege: PrivilegeRequestModel): Promise<PrivilegeResponseModel | null>;
}