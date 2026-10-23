import { ExploreFilters, ExploreSampleRow } from "../../../../src/domain/entities/explore";
import { ProjectStatsSampleRow } from "../../../../src/domain/entities/project-stats";
import { ProjectPrivacyLevel, ProjectResponseModel } from "../../../../src/domain/entities/project";
import { PublicPrivilege } from "../../../../src/domain/entities/privilege";
import { MinimalUserModel } from "../../../../src/domain/entities/user";
import { ExploreProjectContext } from "../../../../src/domain/use-cases/explore/explore-selection";

/* Shared fixtures of the Explore tests: projects whose privacy status does not depend on the day
 * the tests run, light sample rows and project contexts. */

// Durations in months that give a project sampled in 2024 the same status whatever "now" is.
export const PRIVACY_DURATIONS: Record<ProjectPrivacyLevel, Pick<ProjectResponseModel, "privacy_duration" | "visible_duration" | "public_duration">> = {
    private: { privacy_duration: 10000, visible_duration: 0, public_duration: 0 },
    visible: { privacy_duration: 0, visible_duration: 10000, public_duration: 0 },
    public: { privacy_duration: 0, visible_duration: 0, public_duration: 10000 },
    open: { privacy_duration: 0, visible_duration: 0, public_duration: 0 },
};

export function exploreProject(project_id: number, privacy: ProjectPrivacyLevel, overrides: Partial<ProjectResponseModel> = {}): ProjectResponseModel {
    return {
        ecotaxa_project_id: null,
        ecotaxa_project_name: null,
        ecotaxa_instance_id: null,
        project_id,
        project_creation_utc_date_time: "2024-01-15 09:30:00",
        // The privacy delays run from the oldest sample.
        oldest_sample_utc_date_time: "2024-01-10T08:00:00Z",
        root_folder_path: `/remote/plankton/uvp6/project_${project_id}`,
        project_title: `Project ${project_id}`,
        project_acronym: `P${project_id}`,
        project_description: "UVP6 profiles of the Ligurian sea",
        cruise: "MOOSE-GE 2024",
        ship: "Tethys II",
        data_owner_name: "Marc Picheral",
        data_owner_email: "picheral@obs-vlfr.fr",
        operator_name: "Camille Catalano",
        operator_email: "catalano@imev-mer.fr",
        chief_scientist_name: "Lars Stemmann",
        chief_scientist_email: "stemmann@imev-mer.fr",
        enable_descent_filter: false,
        instrument_model: "UVP6LP",
        serial_number: "000008LP",
        ...PRIVACY_DURATIONS[privacy],
        ...overrides,
    };
}

export function exploreSample(overrides: Partial<ExploreSampleRow> = {}): ExploreSampleRow {
    return {
        sample_id: 1,
        sample_name: "moose_ge_2024_001",
        project_id: 1,
        latitude: 43.4,
        longitude: 7.87,
        sampling_utc_date_time: "2024-06-12T10:20:00Z",
        max_pressure: 512.4,
        sample_type_label: "Depth",
        visual_qc_status_label: "VALIDATED",
        ctd_imported: false,
        ctd_file_extension: null,
        ecotaxa_sample_imported: false,
        ecotaxa_sample_id: null,
        nb_vignettes: 1200,
        nb_particles: 345678,
        particle_min_area_px: 1,
        particle_max_area_px: 4000,
        filter_first_image: null,
        filter_last_image: null,
        instrument_settings_depth_offset_m: 1.2,
        instrument_settings_image_volume_l: 0.5,
        instrument_settings_aa: 2300,
        instrument_settings_exp: 1.136,
        instrument_settings_particule_minimum_area_pixels: null,
        ...overrides,
    };
}

export const user = (user_id: number, user_name: string): MinimalUserModel => ({ user_id, user_name, email: `${user_name.toLowerCase().replace(/\s+/g, ".")}@imev-mer.fr` });

export const ALICE = user(11, "Alice Martin");      // manager
export const BOB = user(12, "Bob Durand");          // member
export const CAROL = user(13, "Carol Petit");       // no privilege

export function privileges(project_id: number, managers: MinimalUserModel[], members: MinimalUserModel[] = [], contact: MinimalUserModel = managers[0]): PublicPrivilege {
    return { project_id, managers, members, contact };
}

export function exploreContext(project: ProjectResponseModel, overrides: Partial<ExploreProjectContext> = {}): ExploreProjectContext {
    return {
        project,
        privacy: "open",
        role: "user",
        is_my_project: false,
        can_export: true,
        can_figures: true,
        privileges: null,
        nb_samples: 10,
        ...overrides,
    };
}

export function contextsOf(...contexts: ExploreProjectContext[]): Map<number, ExploreProjectContext> {
    return new Map(contexts.map(context => [context.project.project_id, context]));
}

export function exploreFilters(overrides: Partial<ExploreFilters> = {}): ExploreFilters {
    return {
        project_ids: [],
        instrument_models: [],
        bounds: null,
        date_from: null,
        date_to: null,
        months: [],
        sample_names: [],
        hour_range: null,
        pressure_range: null,
        privacy_statuses: [],
        my_projects: false,
        ctd_only: false,
        ecotaxa_imported_only: false,
        ecotaxa_exclude_not_living: false,
        classification_state: "all",
        ...overrides,
    };
}

// A light sample row of the project statistics: the Explore row plus the map, backup and
// instrument-parameter fields.
export function projectStatsSample(overrides: Partial<ProjectStatsSampleRow> = {}): ProjectStatsSampleRow {
    return {
        ...exploreSample(),
        station_id: "st_001",
        sample_latitude: 43.4,
        sample_longitude: 7.87,
        ctd_latitude: null,
        ctd_longitude: null,
        use_ctd_coordinates: false,
        sample_creation_utc_date_time: "2024-07-01T09:00:00.000Z",
        instrument_serial_number: "000008LP",
        instrument_settings_pixel_size_mm: 0.088,
        instrument_settings_acq_gain: 1,
        instrument_settings_acq_threshold: 21,
        instrument_settings_acq_exposure: 800,
        ...overrides,
    };
}
