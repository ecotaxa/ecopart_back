import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { ListShipsUseCase } from "../../interfaces/use-cases/project/list-ships";

export class ListShips implements ListShipsUseCase {
    projectRepository: ProjectRepository

    constructor(projectRepository: ProjectRepository) {
        this.projectRepository = projectRepository
    }

    async execute(): Promise<string[]> {
        return await this.projectRepository.getDistinctShips();
    }
}
