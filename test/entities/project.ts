
// define an example of project entities to use in the tests

import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel, ProjectUpdateModel } from "../../src/domain/entities/project"

export const projectRequestCreationtModel: ProjectRequestCreationtModel = {
    root_folder_path: 'root_folder_path',
    project_title: 'project_title',
    project_acronym: 'project_acronym',
    project_description: 'project_description',
    project_information: 'project_information',
    cruise: 'cruise',
    ship: ['ship1', 'ship2'],
    data_owner_name: 'data_owner_name',
    data_owner_email: 'data_owner_email',
    operator_name: 'operator_name',
    operator_email: 'operator_email',
    chief_scientist_name: 'chief_scientist_name',
    chief_scientist_email: 'chief_scientist_email',
    override_depth_offset: 1,
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

export const projectUpdateModel: Partial<ProjectUpdateModel> = {
    operator_email: "edited_user@email.com",
    operator_name: "Edited name"
}
// define unvalid example of project entities to use in the tests

