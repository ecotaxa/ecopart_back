
// define an example of project entities to use in the tests

import { ProjectRequestCreationModel, ProjectRequestModel, ProjectResponseModel, ProjectUpdateModel, PublicProjectRequestCreationModel, PublicProjectResponseModel, PublicProjectUpdateModel } from "../../src/domain/entities/project"
import { MinimalUserModel } from "../../src/domain/entities/user"

export const projectRequestCreationModel: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],

}
export const projectRequestCreationModelForRepository: ProjectRequestCreationModel = {
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
    instrument_model: 1,
    serial_number: 'serial_number'
}

export const projectRequestCreationModel_2: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}
export const data_source_projectRequestCreationModel_2: ProjectRequestCreationModel = {
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
    instrument_model: 1,
    serial_number: 'serial_number'
}
export const projectRequestCreationModel_3: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}
export const data_source_projectRequestCreationModel_3: ProjectRequestCreationModel = {
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
    enable_descent_filter: true,
    privacy_duration: 1,
    visible_duration: 1,
    public_duration: 1,
    instrument_model: 1,
    serial_number: 'serial_number'
}
export const projectRequestCreationModel_4: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}
export const data_source_projectRequestCreationModel_4: ProjectRequestCreationModel = {
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
    instrument_model: 1,
    serial_number: 'serial_number'
}
export const projectRequestCreationModel_5: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}
export const data_source_projectRequestCreationModel_5: ProjectRequestCreationModel = {
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
    instrument_model: 1,
    serial_number: 'serial_number'
}
export const projectRequestCreationModel_6: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5SD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}
export const data_source_projectRequestCreationModel_6: ProjectRequestCreationModel = {
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
    instrument_model: 2, //"UVP5SD",
    serial_number: 'serial_number'
}

export const projectRequestCreationModel_withDataToSanitize: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5HD",
    serial_number: ' serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}

export const projectRequestCreationModel_withDataSanitized: PublicProjectRequestCreationModel = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}

export const projectRequestCreationModel_withmissingData = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: {} as MinimalUserModel,
    managers: []
}

export const projectRequestCreationModel_withmissingData_2 = {
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
    instrument_model: "UVP5SD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{} as MinimalUserModel],
    members: [{} as MinimalUserModel],
}

export const projectRequestCreationModel_withmissingOverrideDepthOffset = {
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
    instrument_model: "UVP5HD",
    serial_number: 'serial_number',
    contact: { user_id: 1 } as MinimalUserModel,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [{ user_id: 2 } as MinimalUserModel],
}
export const privateProjectRequestCreationModel_withmissingOverrideDepthOffset = {
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
    instrument_model: 1,
    serial_number: 'serial_number'
}

export const projectResponseModel: PublicProjectResponseModel = {
    ...projectRequestCreationModel,
    project_id: 1,
    project_creation_date: '2024-04-29 15:43:10'
}

export const projectResponseModel2: PublicProjectResponseModel = {
    ...projectRequestCreationModel,
    project_id: 2,
    project_creation_date: '2024-04-30 12:15:11'
}

export const projectResponseModelArray: PublicProjectResponseModel[] = [projectResponseModel, projectResponseModel2]

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

export const partial_projectUpdateModel_withInvalidData: Partial<PublicProjectUpdateModel> = {
    instrument_model: "invalid_param"
}

export const projectUpdateModel: PublicProjectUpdateModel = {
    operator_email: "edited_user@email.com",
    operator_name: "Edited name",
    project_id: 1
}
export const privateProjectUpdateModel: ProjectUpdateModel = {
    operator_email: "edited_user@email.com",
    operator_name: "Edited name",
    enable_descent_filter: true,
    project_id: 1
}

export const projectUpdateModel_withBadData: ProjectUpdateModel = {
    project_id: 1,
    unauthorized_param: "unauthorized_param"
}

export const projectUpdateModel_withPrivilegeUpdate: PublicProjectUpdateModel = {
    ...projectUpdateModel,
    managers: [{ user_id: 2 } as MinimalUserModel],
    members: [{ user_id: 3 } as MinimalUserModel],
    contact: { user_id: 4 } as MinimalUserModel,
}

export const projectUpdateModel_withInstrumentModel: PublicProjectUpdateModel = {
    ...projectUpdateModel,
    instrument_model: "UVP5HD"
}


export const projectUpdateModel_withPartialPrivilegeUpdate: PublicProjectUpdateModel = {
    ...projectUpdateModel,
    managers: [{ user_id: 2 } as MinimalUserModel],
    members: [{ user_id: 3 } as MinimalUserModel]
}

export const private_projectResponseModel: ProjectResponseModel = {
    ...projectRequestCreationModel,
    project_id: 1,
    project_creation_date: '2024-04-29 15:43:10'
}