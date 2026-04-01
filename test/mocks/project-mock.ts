import { ProjectRequestCreationModel, ProjectResponseModel, PublicProjectResponseModel } from "../../src/domain/entities/project";
import { PublicHeaderSampleResponseModel, PublicImportableEcoTaxaSampleResponseModel, PublicSampleModel } from "../../src/domain/entities/sample";
import { SearchInfo, SearchResult } from "../../src/domain/entities/search";
import { TaskResponseModel } from "../../src/domain/entities/task";
import { ProjectRepository } from "../../src/domain/interfaces/repositories/project-repository"
import { BackupProjectUseCase } from "../../src/domain/interfaces/use-cases/project/backup-project";
import { CreateProjectUseCase } from "../../src/domain/interfaces/use-cases/project/create-project";
import { DeleteProjectUseCase } from "../../src/domain/interfaces/use-cases/project/delete-project";
import { ExportBackupedProjectUseCase } from "../../src/domain/interfaces/use-cases/project/export-backuped-project";
import { SearchProjectsUseCase } from "../../src/domain/interfaces/use-cases/project/search-project";
import { UpdateProjectUseCase } from "../../src/domain/interfaces/use-cases/project/update-project";
import { DeleteSampleUseCase } from "../../src/domain/interfaces/use-cases/sample/delete-sample";
import { ImportSamplesUseCase } from "../../src/domain/interfaces/use-cases/sample/import-samples";
import { ListImportableSamplesUseCase } from "../../src/domain/interfaces/use-cases/sample/list-importable-samples";
import { SearchSamplesUseCase } from "../../src/domain/interfaces/use-cases/sample/search-samples";
import { ListShipsUseCase } from "../../src/domain/interfaces/use-cases/project/list-ships";
import { SearchEcoTaxaSamplesUseCase } from "../../src/domain/interfaces/use-cases/ecotaxa_sample/search-ecotaxa-samples";
import { DeleteEcoTaxaSamplesUseCase } from "../../src/domain/interfaces/use-cases/ecotaxa_sample/delete-ecotaxa-samples";
import { ImportEcoTaxaSamplesUseCase } from "../../src/domain/interfaces/use-cases/ecotaxa_sample/import-ecotaxa-samples";
import { ListImportableEcoTaxaSamplesUseCase } from "../../src/domain/interfaces/use-cases/ecotaxa_sample/list-importable-ecotaxa-samples";

export class MockProjectRepository implements ProjectRepository {
    createProjectRootFolder(): Promise<void> {
        throw new Error("Method not implemented for createProjectRootFolder");
    }
    ensureFolderStructureForBackup(): Promise<void> {
        throw new Error("Method not implemented for ensureFolderStructureForBackup");
    }
    copyL0bToProjectFolder(): Promise<void> {
        throw new Error("Method not implemented for copyL0bToProjectFolder");
    }
    ensureBackupExist(): Promise<void> {
        throw new Error("Method not implemented for ensureBackupExist");
    }
    exportBackupedProjectToFtp(): Promise<string> {
        throw new Error("Method not implemented for exportBackupedProjectToFtp");
    }
    exportBackupedProjectToFs(): Promise<string> {
        throw new Error("Method not implemented for exportBackupedProjectToFs");
    }
    formatProjectRequestCreationModel(): ProjectRequestCreationModel {
        throw new Error("Method not implemented for formatProjectRequestCreationModel");
    }
    toPublicProject(): PublicProjectResponseModel {
        throw new Error("Method not implemented for toPublicProject");
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
    ensureEcotaxaProjectNotLinkedToAnotherEcopartProject(): Promise<void> {
        throw new Error("Method not implemented : ensureEcotaxaProjectNotLinkedToAnotherEcopartProject");
    }
    getDistinctShips(): Promise<string[]> {
        throw new Error("Method not implemented : getDistinctShips");
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
    getDistinctShips(): Promise<string[]> {
        throw new Error("Method not implemented : getDistinctShips");
    }
}

// PRESENTATION LAYER

export class MockCreateProjectUseCase implements CreateProjectUseCase {
    execute(): Promise<PublicProjectResponseModel> {
        throw new Error("Method not implemented for create project")
    }
}
export class MockUpdateProjectUseCase implements UpdateProjectUseCase {
    execute(): Promise<PublicProjectResponseModel> {
        throw new Error("Method not implemented for update project")
    }
}

export class MockDeleteProjectUseCase implements DeleteProjectUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for delete project")
    }
}

export class MockSearchProjectsUseCase implements SearchProjectsUseCase {
    execute(): Promise<{ projects: PublicProjectResponseModel[]; search_info: any; }> {
        throw new Error("Method not implemented for search projects")
    }
}
export class MockBackupProjectUseCase implements BackupProjectUseCase {
    execute(): Promise<TaskResponseModel> {
        throw new Error("Method not implemented for backup project")
    }
}
export class MockExportBackupedProjectUseCase implements ExportBackupedProjectUseCase {
    execute(): Promise<TaskResponseModel> {
        throw new Error("Method not implemented for export backuped project")
    }
}
export class MockListImportableSamplesUseCase implements ListImportableSamplesUseCase {
    execute(): Promise<PublicHeaderSampleResponseModel[]> {
        throw new Error("Method not implemented for import backuped project")
    }
}
export class MockImportSamplesUseCase implements ImportSamplesUseCase {
    execute(): Promise<TaskResponseModel> {
        throw new Error("Method not implemented for import samples")
    }
}
export class MockDeleteSampleUseCase implements DeleteSampleUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for delete sample")
    }
}
export class MockSearchSamplesUseCase implements SearchSamplesUseCase {
    execute(): Promise<{ samples: PublicSampleModel[], search_info: SearchInfo }> {
        throw new Error("Method not implemented for search samples")
    }
}

export class MockListShipsUseCase implements ListShipsUseCase {
    execute(): Promise<string[]> {
        throw new Error("Method not implemented for ListShipsUseCase");
    }
}

export class MockListImportableEcoTaxaSamplesUseCase implements ListImportableEcoTaxaSamplesUseCase {
    execute(): Promise<PublicImportableEcoTaxaSampleResponseModel[]> {
        throw new Error("Method not implemented for list importable eco taxa samples");
    }
}

export class MockImportEcoTaxaSamplesUseCase implements ImportEcoTaxaSamplesUseCase {
    execute(): Promise<TaskResponseModel> {
        throw new Error("Method not implemented for import eco taxa samples");
    }
}

export class MockDeleteEcoTaxaSamplesUseCase implements DeleteEcoTaxaSamplesUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for delete eco taxa samples");
    }
}

export class MockSearchEcoTaxaSamplesUseCase implements SearchEcoTaxaSamplesUseCase {
    execute(): Promise<{ samples: PublicSampleModel[], search_info: SearchInfo }> {
        throw new Error("Method not implemented for search eco taxa samples");
    }
}
