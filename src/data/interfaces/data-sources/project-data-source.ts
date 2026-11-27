import { ProjectRequestCreationModel, ProjectRequestModel, ProjectUpdateModel, ProjectResponseModel, ProjectSampleCountsOptions } from "../../../domain/entities/project";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export type { ProjectSampleCountsOptions };

export interface ProjectDataSource {
    create(project: ProjectRequestCreationModel): Promise<number>;
    // `nbr_sample` / `nbr_ctd_sample` can be filtered and sorted on; with `sample_counts` they are also returned.
    getAll(options: PreparedSearchOptions, sample_counts?: ProjectSampleCountsOptions): Promise<SearchResult<ProjectResponseModel>>;
    updateOne(project: ProjectUpdateModel): Promise<number>;
    getOne(project: ProjectRequestModel): Promise<ProjectResponseModel | null>;
    deleteOne(project: ProjectRequestModel): Promise<number>;
    getDistinctShips(): Promise<string[]>;
    // IDs of the EcoTaxa projects of this instance linked to an EcoPart project.
    getLinkedEcotaxaProjectIds(ecotaxa_instance_id: number): Promise<number[]>;
}