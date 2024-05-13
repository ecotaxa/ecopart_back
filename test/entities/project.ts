
// define an example of project entities to use in the tests

import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel, ProjectUpdateModel } from "../../src/domain/entities/project"

export const projectRequestCreationtModel: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}

export const projectRequestCreationtModel_2: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'joan project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: false,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}
export const projectRequestCreationtModel_3: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'john project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}
export const projectRequestCreationtModel_4: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'alice project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}
export const projectRequestCreationtModel_5: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'marc project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}
export const projectRequestCreationtModel_6: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'julie project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'uvp5'
}

export const projectRequestCreationtModel_withDataToSanitize: ProjectRequestCreationtModel = {
    root_folder_path: ' root_folder_path',
    project_title: ' project_title',
    project_acronym: ' project_acronym ',
    project_description: ' project_description',
    project_information: ' project_information',
    cruise: ' cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: ' Data_owner_name',
    data_owner_email: 'Data_owner_email@email.fr',
    operator_name: ' operator_name',
    operator_email: ' operatOr_email@email.fr',
    chief_scientist_name: ' chief_scientist_name',
    chief_scientist_email: ' chief_scientist_emaiL@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: ' instrument'
}

export const projectRequestCreationtModel_withDataSanitized: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'Data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}

export const projectRequestCreationtModel_withmissingData = {
    root_folder_path: 'root_folder_path',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    override_depth_offset: 1,
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}

export const projectRequestCreationtModel_withmissingOverrideDepthOffset = {
    root_folder_path: 'root_folder_path',
    project_title: 'project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: "['ship1', 'ship2']",
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email@email.fr',
    operator_name: 'operator_name',
    operator_email: 'operator_email@email.fr',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email@email.fr',
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument: 'instrument'
}
export const projectResponseModel: ProjectResponseModel = {
    ...projectRequestCreationtModel,
    project_id: 1,
    project_creation_date: '2024-04-29 15:43:10'
}
export const ProjectResponseModel2: ProjectResponseModel = {
    ...projectRequestCreationtModel,
    project_id: 2,
    project_creation_date: '2024-04-30 12:15:11'
}


export const projectResponseModelArray: ProjectResponseModel[] = [projectResponseModel, ProjectResponseModel2]

export const projectRequestModel: ProjectRequestModel = {
    project_id: 1
}

export const partial_projectUpdateModel_toSanatize: Partial<ProjectUpdateModel> = {
    operator_email: " EdiTed_user@email.com   ",
    operator_name: "  Edited name  "
}

export const partial_projectUpdateModel: Partial<ProjectUpdateModel> = {
    operator_email: "edited_user@email.com",
    operator_name: "Edited name"
}

export const projectUpdateModel: ProjectUpdateModel = {
    operator_email: "edited_user@email.com",
    operator_name: "Edited name",
    project_id: 1
}

export const projectUpdateModel_withBadData: ProjectUpdateModel = {
    project_id: 1,
    unauthorized_param: "unauthorized_param"
}

// define unvalid example of project entities to use in the tests

