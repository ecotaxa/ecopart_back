export interface EcotaxaInstanceModel {
    ecotaxa_instance_id: number;
    ecotaxa_instance_name: string;
    ecotaxa_instance_description: string;
    ecotaxa_instance_creation_utc_date_time: string;
    ecotaxa_instance_url: string;
}
export interface EcotaxaInstanceRequestCreationModel {
    ecotaxa_instance_name: string;
    ecotaxa_instance_description: string;
    ecotaxa_instance_url: string;
}
export interface EcotaxaAccountRequestCreationModel {
    ecotaxa_account_ecotaxa_id: number;
    ecotaxa_account_ecopart_user_id: number;
    ecotaxa_account_token: string;
    ecotaxa_account_user_name: string;
    ecotaxa_account_user_email: string;
    ecotaxa_account_instance_id: number;
    ecotaxa_account_expiration_utc_date_time: string;
}

export interface EcotaxaAccountResponseModel extends EcotaxaAccountRequestCreationModel {
    ecotaxa_account_id: number;
    ecotaxa_account_creation_utc_date_time: string;
    ecotaxa_account_instance_name: string;
}

export interface EcotaxaAccountRequestModel {
    ecotaxa_account_id: number;
    ecotaxa_account_ecopart_user_id: number;
}

export interface PublicEcotaxaAccountRequestCreationModel {
    ecopart_user_id: number;
    ecotaxa_user_login: string;
    ecotaxa_user_password: string;
    ecotaxa_instance_id: number;
}

export interface EcotaxaAccountModel {
    ecotaxa_token: string;
    ecotaxa_user_name: string;
    ecotaxa_account_ecotaxa_id: number;
    ecotaxa_expiration_date: string;
}

export interface PublicEcotaxaAccountResponseModel {
    ecotaxa_account_instance_id: number;
    ecotaxa_account_id: number;
    ecotaxa_account_ecotaxa_id: number;
    ecotaxa_user_name: string;
    ecotaxa_user_email: string;
    ecotaxa_expiration_date: string;
    ecotaxa_account_instance_name: string;
}

export interface EcotaxaAccountUser {
    id: number,
    email: string,
    password: string,
    name: string,
    organisation: string,
    status: number,
    status_date: string,
    status_admin_comment: string,
    country: string,
    orcid: string,
    usercreationdate: string,
    usercreationreason: string,
    mail_status: boolean,
    mail_status_date: string,
    can_do: number[],
    last_used_projects: object[],
}

export interface EcoTaxaProject {
    highest_right: "Read" | "Annotate" | "Manage";
}
// GET api/taxon_set/query (EcoTaxa TaxonModel, the fields the Explore page uses).
export interface EcoTaxaTaxon {
    id: number;
    name: string;
    display_name: string;
    id_lineage: number[];                     // ancestors' ids, self first
    nb_objects: number;
}

// POST api/object_set/{project_id}/query: filters (ProjectFiltersModel, e.g. { samples: "12,13" }),
// fields ("obj.depth_min,img.file_name,…") and a window of the result.
export interface EcoTaxaObjectSetQuery {
    filters: Record<string, string>;
    fields: string[];
    order_field?: string;
    window_start?: number;
    window_size?: number;
}

export interface EcoTaxaObjectSetPage {
    total_ids: number;
    object_ids: number[];
    details: (string | number | null)[][];   // one row per object, in the order of the fields
}
