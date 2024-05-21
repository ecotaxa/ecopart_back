

export interface ProjectRequestCreationtModel {
    root_folder_path: string;
    project_title: string;
    project_acronym: string;
    project_description: string;
    project_information?: string;
    cruise: string;
    ship: string;
    data_owner_name: string;
    data_owner_email: string;
    operator_name: string;
    operator_email: string;
    chief_scientist_name: string;
    chief_scientist_email: string;
    override_depth_offset?: number;
    enable_descent_filter: boolean;
    privacy_duration: number;
    visible_duration: number;
    public_duration: number;
    instrument_model: number;
    serial_number: string;
}
export interface ProjectResponseModel extends ProjectRequestCreationtModel {
    project_id: number;
    project_creation_date: string;
}
export interface ProjectRequestModel {
    project_id: number;
}

export interface ProjectUpdateModel {
    [key: string]: any;
    project_id: number;
    root_folder_path?: string;
    project_title?: string;
    project_acronym?: string;
    project_description?: string;
    project_information?: string;
    cruise?: string;
    ship?: string;
    data_owner_name?: string;
    data_owner_email?: string;
    operator_name?: string;
    operator_email?: string;
    chief_scientist_name?: string;
    chief_scientist_email?: string;
    override_depth_offset?: number;
    enable_descent_filter?: boolean;
    privacy_duration?: number;
    visible_duration?: number;
    public_duration?: number;
    instrument_model?: number;
    serial_number?: string;
}

export interface PublicProjectUpdateModel {
    [key: string]: any;
    project_id: number;
    root_folder_path?: string;
    project_title?: string;
    project_acronym?: string;
    project_description?: string;
    project_information?: string;
    cruise?: string;
    ship?: string;
    data_owner_name?: string;
    data_owner_email?: string;
    operator_name?: string;
    operator_email?: string;
    chief_scientist_name?: string;
    chief_scientist_email?: string;
    override_depth_offset?: number;
    enable_descent_filter?: boolean;
    privacy_duration?: number;
    visible_duration?: number;
    public_duration?: number;
    instrument_model?: string;
    serial_number?: string;
}
export interface PublicProjectRequestCreationtModel {
    project_id: number;
    root_folder_path: string;
    project_title: string;
    project_acronym: string;
    project_description: string;
    project_information?: string;
    cruise: string;
    ship: string;
    data_owner_name: string;
    data_owner_email: string;
    operator_name: string;
    operator_email: string;
    chief_scientist_name: string;
    chief_scientist_email: string;
    override_depth_offset?: number;
    enable_descent_filter: boolean;
    privacy_duration: number;
    visible_duration: number;
    public_duration: number;
    instrument_model: string;
    serial_number: string;
}

export interface PublicProjectResponseModel extends PublicProjectRequestCreationtModel {
    project_id: number;
    project_creation_date: string;
}

// // FOR acess permissions LATER
// export interface ProjectVisibility {
//     visibility_id: number;
//     visibility_name: ProjectVisibilityStatus;
//     visibility_creation_date: string;
// }
// // TODO ENUM TO CREATE IN DB
// export enum ProjectVisibilityStatus {
//     Private = "Private",
//     Visible = "Visible",
//     Public = "Public",
//     Public_plus = "Public+"
// }