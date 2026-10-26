import { ProjectRequestModel } from "../../entities/project";
import { ProjectStatsResponseModel } from "../../entities/project-stats";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetProjectStatsUseCase } from "../../interfaces/use-cases/project/get-project-stats";
import { ExploreEcoTaxaService } from "../explore/explore-ecotaxa";
import { ExploreProjectContext } from "../explore/explore-selection";
import { buildExploreSummary } from "../explore/explore-stats";
import { isProjectActionAllowed, privacyOf, ProjectAccessPolicy } from "./project-access";
import {
    buildProjectStatsEcoTaxa,
    buildProjectStatsMap,
    buildProjectStatsPrivacy,
    buildProjectStatsRawBackup,
    buildProjectStatsSamples,
    countStations,
    EMPTY_ECOTAXA_SUMMARY,
} from "./project-stats";

// The statistics of a project, for its STATS tab. Served to any logged-in user, like the project
// metadata ("see" in the access matrix); the raw backup state is an operational detail of the
// members and stays hidden from a user without privilege on the project.
export class GetProjectStats implements GetProjectStatsUseCase {
    private readonly access: ProjectAccessPolicy;

    constructor(
        private readonly userRepository: UserRepository,
        private readonly projectRepository: ProjectRepository,
        private readonly privilegeRepository: PrivilegeRepository,
        private readonly sampleRepository: SampleRepository,
        private readonly taskRepository: TaskRepository,
        private readonly ecotaxa: ExploreEcoTaxaService,
        private readonly now: () => Date = () => new Date(),
    ) {
        this.access = new ProjectAccessPolicy(userRepository, privilegeRepository);
    }

    async execute(current_user: UserUpdateModel, project_to_get: ProjectRequestModel): Promise<ProjectStatsResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const project = await this.projectRepository.getProject(project_to_get);
        if (!project) throw new Error("Cannot find project");
        const role = await this.access.roleOf(current_user.user_id, project.project_id);

        const now = this.now();
        const [samples, exports] = await Promise.all([
            this.sampleRepository.getProjectStatsSamples(project.project_id),
            this.taskRepository.countExportTasks(project.project_id),
        ]);

        const privacy = privacyOf(project, now);
        const context: ExploreProjectContext = {
            project,
            privacy,
            role,
            is_my_project: role === "manager" || role === "member",
            can_export: isProjectActionAllowed(role, privacy, "export_particles"),
            can_figures: isProjectActionAllowed(role, privacy, "figures"),
            privileges: null,
            nb_samples: samples.length,
        };
        const contexts = new Map([[project.project_id, context]]);
        const summary = buildExploreSummary(samples, contexts);
        const linked = project.ecotaxa_project_id !== null && project.ecotaxa_instance_id !== null;
        const ecotaxa = linked ? await this.ecotaxa.summaryOf(samples, contexts, false) : EMPTY_ECOTAXA_SUMMARY;

        return {
            project_id: project.project_id,
            generated_at: now.toISOString(),
            counts: {
                stations: countStations(samples),
                samples: samples.length,
                particles: summary?.counts.particles ?? 0,
                vignettes: summary?.counts.images ?? 0,
                exports,
            },
            privacy: buildProjectStatsPrivacy(project, now),
            raw_backup: role === "user" ? null : buildProjectStatsRawBackup(project, samples),
            map: buildProjectStatsMap(samples),
            samples: buildProjectStatsSamples(summary, samples, now),
            ecotaxa: buildProjectStatsEcoTaxa(ecotaxa, samples, linked),
        };
    }
}
