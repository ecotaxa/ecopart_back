export interface EcotaxaInstanceModel {
    ecotaxa_instance_id: number;
    ecotaxa_instance_name: string;
    ecotaxa_instance_description: string;
    ecotaxa_instance_creation_date: string;
    ecotaxa_instance_url: string;
}
export interface EcotaxaAccountRequestCreationModel {
    ecotaxa_account_ecotaxa_id: number;
    ecotaxa_account_ecopart_user_id: number;
    ecotaxa_account_token: string;
    ecotaxa_account_user_name: string;
    ecotaxa_account_user_email: string;
    ecotaxa_account_instance_id: number;
    ecotaxa_account_expiration_date: string;
}

export interface EcotaxaAccountResponseModel extends EcotaxaAccountRequestCreationModel {
    ecotaxa_account_id: number;
    ecotaxa_account_creation_date: string;
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