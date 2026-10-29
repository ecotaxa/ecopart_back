import { ProjectQcStateModel } from "../../entities/project-stats";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetProjectsQcStatesUseCase } from "../../interfaces/use-cases/project/get-projects-qc-states";
import { LandMask } from "../../interfaces/geography/land-mask";
import { buildProjectQcState } from "./project-stats";

// At most this many projects per call: a page of the project lists.
export const PROJECTS_QC_STATES_MAX = 100;

// The QC state of a page of projects, for the project lists: the warnings their STATS tab shows,
// read from the database only (the EcoTaxa classification as last stored, EcoTaxa is not asked).
// Served to any logged-in user, like the statistics; the raw backup warning only to the admins and
// to the users with a privilege on the project. Unknown ids are left out of the answer.
export class GetProjectsQcStates implements GetProjectsQcStatesUseCase {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly projectRepository: ProjectRepository,
        private readonly privilegeRepository: PrivilegeRepository,
        private readonly sampleRepository: SampleRepository,
        private readonly land: LandMask,
        private readonly now: () => Date = () => new Date(),
    ) { }

    async execute(current_user: UserUpdateModel, project_ids: number[]): Promise<ProjectQcStateModel[]> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const ids = Array.from(new Set(project_ids));
        if (ids.length > PROJECTS_QC_STATES_MAX) throw new Error(`Too many projects, at most ${PROJECTS_QC_STATES_MAX}`);
        if (ids.length === 0) return [];

        const is_admin = await this.userRepository.isAdmin(current_user.user_id);
        const granted = new Set(is_admin ? [] : await this.privilegeRepository.getProjectsByUser({ user_id: current_user.user_id }));
        const { items } = await this.projectRepository.standardGetProjects({
            filter: [{ field: "project_id", operator: "IN", value: ids }],
            sort_by: [],
            page: 1,
            limit: ids.length,
        });
        const projects = new Map(items.map(project => [project.project_id, project]));

        const now = this.now();
        const states: ProjectQcStateModel[] = [];
        for (const project_id of ids) {
            const project = projects.get(project_id);
            if (!project) continue;
            const samples = await this.sampleRepository.getProjectStatsSamples(project_id);
            const stored = await this.sampleRepository.getEcoTaxaStats(samples.filter(sample => sample.ecotaxa_sample_imported).map(sample => sample.sample_id));
            states.push(buildProjectQcState(project, samples, stored, is_admin || granted.has(project_id), this.land, now));
        }
        return states;
    }
}
