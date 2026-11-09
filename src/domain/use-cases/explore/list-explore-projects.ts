import { ExploreProjectOption } from "../../entities/explore";
import { UserUpdateModel } from "../../entities/user";
import { ListExploreProjectsUseCase } from "../../interfaces/use-cases/explore/list-explore-projects";
import { ExploreSelectionRepositories, loadExploreProjects, resolveExploreUser } from "./explore-selection";

// The choices of the project criterion: every project of the application, anonymous callers included
// (the spec lets anyone see a project exists, so that access can be requested).
export class ListExploreProjects implements ListExploreProjectsUseCase {
    constructor(private readonly repositories: ExploreSelectionRepositories) { }

    async execute(current_user: UserUpdateModel | null): Promise<ExploreProjectOption[]> {
        const user = await resolveExploreUser(this.repositories.userRepository, current_user);
        const projects = await loadExploreProjects(this.repositories, user);
        return Array.from(projects.values())
            .map(context => ({ project_id: context.project.project_id, project_title: context.project.project_title, nb_samples: context.nb_samples }))
            .sort((a, b) => a.project_title.localeCompare(b.project_title) || a.project_id - b.project_id);
    }
}
