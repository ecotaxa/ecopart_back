import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { ListShipsUseCase } from "../../interfaces/use-cases/project/list-ships";

export class ListShips implements ListShipsUseCase {
    projectRepository: ProjectRepository

    constructor(projectRepository: ProjectRepository) {
        this.projectRepository = projectRepository
    }

    async execute(): Promise<string[]> {
        const ships: string[] = [];

        // return distinct list of ships names, we need to transform it to be an array of unique ship names [["ship1, ship2"], ["ship1, ship3"]] => [ship1, ship2, ship3]]
        const distinctShipsLists = await this.projectRepository.getDistinctShips();

        distinctShipsLists.reduce((acc, shipList) => {
            const shipNames = shipList.split(',').map(name => name.trim());
            shipNames.forEach(name => {
                if (name && !acc.includes(name)) {
                    acc.push(name);
                }
            });
            return acc;
        }, ships);

        // order ships alphabetically
        ships.sort((a, b) => a.localeCompare(b));
        return ships;
    }
}
