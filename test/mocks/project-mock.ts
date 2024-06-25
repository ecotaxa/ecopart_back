import { ProjectRequestCreationModel, ProjectResponseModel, PublicProjectResponseModel } from "../../src/domain/entities/project";
import { SearchResult } from "../../src/domain/entities/search";
import { ProjectRepository } from "../../src/domain/interfaces/repositories/project-repository"

export class MockProjectRepository implements ProjectRepository {
    formatProjectRequestCreationModel(): ProjectRequestCreationModel {
        throw new Error("Method not implemented.");
    }
    toPublicProject(): PublicProjectResponseModel {
        throw new Error("Method not implemented.");
    }
    standardUpdateProject(): Promise<number> {
        throw new Error("Method not implemented : standardUpdateProject");
    }
    createProject(): Promise<number> {
        throw new Error("Method not implemented : createProject");
    }
    getProject(): Promise<ProjectResponseModel | null> {
        throw new Error("Method not implemented : getProject");
    }
    computeDefaultDepthOffset(): number | undefined {
        throw new Error("Method not implemented : computeDefaultDepthOffset");
    }
    deleteProject(): Promise<number> {
        throw new Error("Method not implemented : deleteProject");
    }
    standardGetProjects(): Promise<SearchResult<ProjectResponseModel>> {
        throw new Error("Method not implemented : standardGetProjects");
    }

}

export class MockProjectDataSource {
    create(): Promise<number> {
        throw new Error("Method not implemented : create");
    }
    getAll(): Promise<SearchResult<ProjectResponseModel>> {
        throw new Error("Method not implemented : getAll");
    }
    updateOne(): Promise<number> {
        throw new Error("Method not implemented : updateOne");
    }
    getOne(): Promise<ProjectResponseModel | null> {
        throw new Error("Method not implemented : getOne");
    }
    deleteOne(): Promise<number> {
        throw new Error("Method not implemented : deleteOne");
    }
}