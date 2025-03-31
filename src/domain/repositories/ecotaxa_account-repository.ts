import { EcotaxaAccountDataSource } from "../../data/interfaces/data-sources/ecotaxa_account-data-source";
import { PublicEcotaxaAccountRequestCreationModel, EcotaxaAccountModel, EcotaxaAccountRequestCreationModel, EcotaxaAccountUser, EcotaxaInstanceModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel, PublicEcotaxaAccountResponseModel } from "../entities/ecotaxa_account";
import { ProjectResponseModel, PublicProjectRequestCreationModel, PublicProjectUpdateModel } from "../entities/project";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { UserUpdateModel } from "../entities/user";
// import { InstrumentModelRequestModel, InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { EcotaxaAccountRepository } from "../interfaces/repositories/ecotaxa_account-repository";

export class EcotaxaAccountRepositoryImpl implements EcotaxaAccountRepository {
    ecotaxa_accountDataSource: EcotaxaAccountDataSource

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    generic_ecotaxa_account_email: string

    // TODO Define the mapping between EcoTaxa and EcoPart instruments in a .env or conf file 
    // ecopart ['UVP5HD', 'UVP5SD', 'UVP5Z', 'UVP6LP', 'UVP6HF', 'UVP6MHP', 'UVP6MHF']
    // ecotaxa ["UVP5HD","UVP5SD","UVP5Z","UVP6"]
    instrument_mapping: { [key: string]: string[] } = {
        "UVP5HD": ["UVP5HD"],
        "UVP5SD": ["UVP5SD"],
        "UVP5Z": ["UVP5Z"],
        "UVP6": ["UVP6LP", "UVP6HF", "UVP6MHP", "UVP6MHF"]
    };
    cnn_network_id_mapping: { [key: string]: string } = {
        "UVP5HD": "UVP5HD-2024-01",
        "UVP5SD": "UVP5SD-2024-01",
        "UVP5Z": "UVP5SD-2024-01",
        "UVP6": "uvp6_beta_2022-01-26"
    };

    constructor(ecotaxa_accountDataSource: EcotaxaAccountDataSource, GENERIC_ECOTAXA_ACCOUNT_EMAIL: string) {
        this.generic_ecotaxa_account_email = GENERIC_ECOTAXA_ACCOUNT_EMAIL
        this.ecotaxa_accountDataSource = ecotaxa_accountDataSource
    }

    async getEcotaxaGenericAccountForInstance(ecotaxa_instance_id: number): Promise<EcotaxaAccountResponseModel> {
        const options: PreparedSearchOptions = {
            filter: [
                { field: "ecotaxa_account_instance_id", operator: "=", value: ecotaxa_instance_id },
                { field: "ecotaxa_account_user_email", operator: "=", value: this.generic_ecotaxa_account_email }
            ],
            sort_by: [],
            page: 1,
            limit: 1
        }
        const ecotaxa_account = await this.internalGetEcotaxaAccountsModels(options)
        if (ecotaxa_account.total === 0) {
            throw new Error("Ecotaxa generic account not found for instance : " + ecotaxa_instance_id);
        }
        const ecotaxa_account_data = ecotaxa_account.items[0]
        // // if generic instance token is expired, throw an error
        // if (new Date(ecotaxa_account_data.ecotaxa_account_expiration_date) < new Date()) {
        //     throw new Error("Ecotaxa generic account token is expired for instance : " + ecotaxa_instance_id);
        // }
        return ecotaxa_account_data
    }
    async api_ecotaxa_login(base_url: string, ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<string> {
        const credentials = {
            username: ecotaxa_account_to_create.ecotaxa_user_login,
            password: ecotaxa_account_to_create.ecotaxa_user_password
        };

        const response = await fetch(base_url + "api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(credentials)
        });

        if (!response.ok) {
            let errorDetails;
            try {
                const clonedResponse = response.clone();
                errorDetails = await clonedResponse.json();
                errorDetails = JSON.stringify(errorDetails, null, 2);
            } catch {
                try {
                    errorDetails = await response.text();
                } catch {
                    errorDetails = "Unknown error (response body could not be read)";
                }
            }

            throw new Error(`Cannot login into EcoTaxa, EcoTaxa HTTP Error: ${response.status} - ${response.statusText} - msg: ${errorDetails}`);
        }

        const token = await response.json() as string;
        return token;

    }
    async api_ecotaxa_me(base_url: string, token: string): Promise<EcotaxaAccountUser> {
        const response = await fetch(base_url + "api/users/me", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            let errorDetails;
            try {
                const clonedResponse = response.clone();
                errorDetails = await clonedResponse.json();
                errorDetails = JSON.stringify(errorDetails, null, 2);
            } catch {
                try {
                    errorDetails = await response.text();
                } catch {
                    errorDetails = "Unknown error (response body could not be read)";
                }
            }

            throw new Error(`Cannot get logged user from EcoTaxa, EcoTaxa HTTP Error: ${response.status} - ${response.statusText} - msg: ${errorDetails}`);
        }

        const data = await response.json();
        return data as EcotaxaAccountUser;
    }
    async api_create_ecotaxa_project(base_url: string, token: string, ecotaxa_project: any): Promise<number> {
        const response = await fetch(base_url + "api/projects/create", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(ecotaxa_project),
            mode: "cors"
        });

        if (!response.ok) {
            let errorDetails;
            try {
                const clonedResponse = response.clone();
                errorDetails = await clonedResponse.json();
                errorDetails = JSON.stringify(errorDetails, null, 2);
            } catch {
                try {
                    errorDetails = await response.text();
                } catch {
                    errorDetails = "Unknown error (response body could not be read)";
                }
            }

            throw new Error(`Cannot create EcoTaxa project, EcoTaxa HTTP Error: ${response.status} - ${response.statusText} - msg: ${errorDetails}`);
        }

        const data = await response.json();
        return data as number;
    }
    async api_get_ecotaxa_project(base_url: string, token: string, ecopart_project_id: number): Promise<any> {
        const response = await fetch(base_url + "api/projects/" + ecopart_project_id, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            let errorDetails;
            try {
                const clonedResponse = response.clone();
                errorDetails = await clonedResponse.json();
                errorDetails = JSON.stringify(errorDetails, null, 2);
            } catch {
                try {
                    errorDetails = await response.text();
                } catch {
                    errorDetails = "Unknown error (response body could not be read)";
                }
            }

            throw new Error(`Cannot get EcoTaxa projevt, EcoTaxa HTTP Error: ${response.status} - ${response.statusText} - msg: ${errorDetails}`);
        }

        const data = await response.json();
        return data;
    }

    async api_update_ecotaxa_project(base_url: string, token: string, ecotaxa_project: any): Promise<null> {
        // returns null uppon success
        const response = await fetch(base_url + "api/projects/" + ecotaxa_project.projid, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(ecotaxa_project),
            mode: "cors"
        });

        if (!response.ok) {
            let errorDetails;
            try {
                const clonedResponse = response.clone();
                errorDetails = await clonedResponse.json();
                errorDetails = JSON.stringify(errorDetails, null, 2);
            } catch {
                try {
                    errorDetails = await response.text();
                } catch {
                    errorDetails = "Unknown error (response body could not be read)";
                }
            }

            throw new Error(`Cannot update EcoTaxa project, EcoTaxa HTTP Error: ${response.status} - ${response.statusText} - msg: ${errorDetails}`);
        }

        const data = await response.json();
        return data;
    }
    async createEcotaxaProject(ecopart_project: PublicProjectRequestCreationModel): Promise<number> {
        const ecotaxa_account_id = ecopart_project.ecotaxa_account_id as number
        const ecotaxa_instance_id = ecopart_project.ecotaxa_instance_id as number

        // get ecotaxa account
        const ecotaxa_account = await this.getOneEcotaxaAccount(ecotaxa_account_id);
        if (!ecotaxa_account) {
            throw new Error("Ecotaxa account not found");
        }

        // get ecotaxa instance
        const ecotaxa_instance = await this.getOneEcoTaxaInstance(ecotaxa_instance_id);
        if (!ecotaxa_instance) {
            throw new Error("Ecotaxa instance not found");
        }

        // create ecotaxa project with same title as ecopart project and mapped instrument
        const ecotaxa_minimal_project = {
            title: ecopart_project.project_title,
            instrument: this.instrument_mapping[ecopart_project.instrument_model as string][0],
        };
        const created_ecotaxa_project_id = await this.api_create_ecotaxa_project(ecotaxa_instance.ecotaxa_instance_url, ecotaxa_account.ecotaxa_account_token, ecotaxa_minimal_project)

        // get ecotaxa project
        const ecotaxa_project = await this.api_get_ecotaxa_project(ecotaxa_instance.ecotaxa_instance_url, ecotaxa_account.ecotaxa_account_token, created_ecotaxa_project_id)
        if (!ecotaxa_project) {
            throw new Error("EcoTaxa project not found");
        }

        // add generic user to the project
        this.add_default_values_to_ecotaxa_project(ecotaxa_instance, ecotaxa_account, ecotaxa_project)
        return created_ecotaxa_project_id;
    }
    async linkEcotaxaAndEcopartProject(public_project: PublicProjectRequestCreationModel): Promise<{ ecotaxa_project_id: number, ecotaxa_project_name: string }> {
        const {
            ecotaxa_project_id,
            ecotaxa_account_id,
            ecotaxa_instance_id
        } = public_project as { ecotaxa_project_id: number; ecotaxa_account_id: number; ecotaxa_instance_id: number };

        // get ecotaxa account
        const ecotaxa_account = await this.getOneEcotaxaAccount(ecotaxa_account_id);
        if (!ecotaxa_account) {
            throw new Error("Ecotaxa account not found");
        }

        // get ecotaxa instance
        const ecotaxa_instance = await this.getOneEcoTaxaInstance(ecotaxa_instance_id);
        if (!ecotaxa_instance) {
            throw new Error("Ecotaxa instance not found");
        }

        // get ecotaxa project
        // check that ecotaxa project exists
        const ecotaxa_project = await this.api_get_ecotaxa_project(ecotaxa_instance.ecotaxa_instance_url, ecotaxa_account.ecotaxa_account_token, ecotaxa_project_id)
        if (!ecotaxa_project) {
            throw new Error("EcoTaxa project not found");
        }

        // check that instruments match 
        this.ensureInstrumentsMatch(ecotaxa_project.instrument, public_project.instrument_model)

        // check that the ecotaxa account is manager in the ecotaxa project
        if (ecotaxa_project.highest_right !== "Manage") throw new Error("EcoTaxa account is not manager in the ecotaxa project");

        this.add_default_values_to_ecotaxa_project(ecotaxa_instance, ecotaxa_account, ecotaxa_project)
        return { ecotaxa_project_id: ecotaxa_project.projid as number, ecotaxa_project_name: ecotaxa_project.title as string };
    }
    async add_default_values_to_ecotaxa_project(ecotaxa_instance: EcotaxaInstanceModel, ecotaxa_account: EcotaxaAccountResponseModel, ecotaxa_project: any): Promise<void> {
        // add default values to ecotaxa project
        const ecotaxa_project_with_generic_user = this.addEcotaxaGenericCnnNetworkToProject(ecotaxa_project)
        const ecotaxa_project_with_cnn = await this.addEcotaxaGenericAccountToProject(ecotaxa_instance, ecotaxa_project_with_generic_user)

        await this.api_update_ecotaxa_project(ecotaxa_instance.ecotaxa_instance_url, ecotaxa_account.ecotaxa_account_token, ecotaxa_project_with_cnn)
    }
    addEcotaxaGenericCnnNetworkToProject(ecotaxa_project: any): any {
        if (ecotaxa_project.cnn_network_id) return ecotaxa_project
        // add generic cnn to the project
        const cnn_network_id = this.cnn_network_id_mapping[ecotaxa_project.instrument]
        ecotaxa_project.cnn_network_id = cnn_network_id
        return ecotaxa_project
    }
    async addEcotaxaGenericAccountToProject(ecotaxa_instance: EcotaxaInstanceModel, ecotaxa_project: any,): Promise<any> {
        // add generic user to the project
        const result = await this.getEcotaxaGenericAccountForInstance(ecotaxa_instance.ecotaxa_instance_id)

        const generic_ecotaxa_account = {
            name: result.ecotaxa_account_user_name,
            email: result.ecotaxa_account_user_email,
            id: result.ecotaxa_account_ecotaxa_id
        };

        ecotaxa_project.managers.push(generic_ecotaxa_account)
        return ecotaxa_project
    }
    async removeEcotaxaGenericAccountFromProject(ecotaxa_instance: EcotaxaInstanceModel, ecotaxa_project: any): Promise<any> {
        // remove generic user from the project
        const result = await this.getEcotaxaGenericAccountForInstance(ecotaxa_instance.ecotaxa_instance_id)

        ecotaxa_project.managers = ecotaxa_project.managers.filter((manager: any) => manager.id !== result.ecotaxa_account_ecotaxa_id)
        return ecotaxa_project
    }
    ensureInstrumentsMatch(ecotaxa_instrument: string, ecopart_instrument: string): void {
        // Get the list of valid EcoPart instruments for the given EcoTaxa instrument
        const valid_ecopart_instruments = this.instrument_mapping[ecotaxa_instrument] || [];

        // Check if the EcoPart instrument is within the allowed list
        if (!valid_ecopart_instruments.includes(ecopart_instrument)) {
            throw new Error(`Instruments do not match, EcoTaxa instrument: ${ecotaxa_instrument} is not compatible with EcoPart instrument: ${ecopart_instrument}`);
        }
    }
    async ecotaxa_account_belongs(user_id: number, ecotaxa_account_id: number): Promise<boolean> {
        const ecotaxa_account = await this.getOneEcotaxaAccount(ecotaxa_account_id, user_id);
        return ecotaxa_account?.ecotaxa_account_ecopart_user_id == user_id || false;
    }
    async createEcotaxaAccount(private_ecotaxa_account_to_create: EcotaxaAccountRequestCreationModel): Promise<number> {
        return await this.ecotaxa_accountDataSource.create(private_ecotaxa_account_to_create);
    }
    async connectToEcotaxaInstance(ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<EcotaxaAccountModel> {
        const instance_url = await this.getInstanceURL(ecotaxa_account_to_create.ecotaxa_instance_id)

        // Connect to the ecotaxa instance login api
        const ecotaxa_token = await this.api_ecotaxa_login(instance_url, ecotaxa_account_to_create)


        const expiration_date = new Date();
        expiration_date.setDate(expiration_date.getDate() + 30);

        const me = await this.api_ecotaxa_me(instance_url, ecotaxa_token)

        // Return the ecotaxa account model
        return {
            ecotaxa_account_ecotaxa_id: me.id,
            ecotaxa_token: ecotaxa_token,
            ecotaxa_user_name: me.name,
            ecotaxa_expiration_date: expiration_date.toISOString()
        }
    }
    async getOneEcotaxaAccount(ecotaxa_account_id: number, ecopart_user_id?: number, ecotaxa_instance_id?: number): Promise<EcotaxaAccountResponseModel | null> {
        const filters = [{ field: "ecotaxa_account_id", operator: "=", value: ecotaxa_account_id }];
        if (ecopart_user_id !== undefined) {
            filters.push({ field: "ecotaxa_account_ecopart_user_id", operator: "=", value: ecopart_user_id });
        }
        if (ecotaxa_instance_id !== undefined) {
            filters.push({ field: "ecotaxa_account_instance_id", operator: "=", value: ecotaxa_instance_id });
        }
        const options: PreparedSearchOptions = {
            filter: filters,
            sort_by: [],
            page: 1,
            limit: 1
        };
        const ecotaxa_account = await this.ecotaxa_accountDataSource.getAll(options);
        return ecotaxa_account.total === 0 ? null : ecotaxa_account.items[0];
    }
    formatEcotaxaAccountResponse(ecotaxa_account: EcotaxaAccountResponseModel): PublicEcotaxaAccountResponseModel {
        return {
            ecotaxa_account_id: ecotaxa_account.ecotaxa_account_id,
            ecotaxa_account_ecotaxa_id: ecotaxa_account.ecotaxa_account_ecotaxa_id,
            ecotaxa_user_name: ecotaxa_account.ecotaxa_account_user_name,
            ecotaxa_expiration_date: ecotaxa_account.ecotaxa_account_expiration_date,
            ecotaxa_account_instance_id: ecotaxa_account.ecotaxa_account_instance_id,
            ecotaxa_account_instance_name: ecotaxa_account.ecotaxa_account_instance_name
        }
    }
    async getInstanceURL(ecotaxa_instance_id: number): Promise<string> {
        const ecotaxa_instance = await this.getOneEcoTaxaInstance(ecotaxa_instance_id);
        if (!ecotaxa_instance) throw new Error("Ecotaxa instance not found : " + ecotaxa_instance_id);
        return ecotaxa_instance.ecotaxa_instance_url;
    }
    async getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null> {
        const ecotaxa_instance = await this.ecotaxa_accountDataSource.getOneEcoTaxaInstance(ecotaxa_instance_id);
        return ecotaxa_instance;
    }
    async ensureUserCanUseEcotaxaAccount(current_user: UserUpdateModel, ecotaxa_account_id: number): Promise<void> {
        if (!await this.ecotaxa_account_belongs(current_user.user_id, ecotaxa_account_id)) {
            throw new Error("User cannot use the provided ecotaxa account current user id: " + current_user.user_id + " ecotaxa account id: " + ecotaxa_account_id);
        }
    }
    async accountExists(ecotaxa_account: PublicEcotaxaAccountRequestCreationModel): Promise<boolean> {
        const options: PreparedSearchOptions = {
            filter: [
                { field: "ecotaxa_account_instance_id", operator: "=", value: ecotaxa_account.ecotaxa_instance_id },
                { field: "ecotaxa_account_user_email", operator: "=", value: ecotaxa_account.ecotaxa_user_login },
                { field: "ecotaxa_account_ecopart_user_id", operator: "=", value: ecotaxa_account.ecopart_user_id }
            ],
            sort_by: [],
            page: 1,
            limit: 99999
        }
        return this.ecotaxa_accountDataSource
            .getAll(options)
            .then(result => result.total > 0);
    }
    async deleteEcotaxaAccount(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number> {
        // Return the number of deleted rows
        const nb_of_deleted_rows = await this.ecotaxa_accountDataSource.deleteOne(ecotaxa_account);
        if (nb_of_deleted_rows === 0) {
            throw new Error("Ecotaxa account not found");
        }
        return nb_of_deleted_rows;
    }

    async standardGetEcotaxaAccountsModels(options: PreparedSearchOptions): Promise<SearchResult<EcotaxaAccountResponseModel>> {
        // Can be filtered by 
        const filter_params_restricted: string[] = ["ecotaxa_account_ecopart_user_id"]

        // Can be sort_by 
        const sort_param_restricted: string[] = ["ecotaxa_account_expiration_date"]

        return await this.getEcotaxaAccountModels(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    async internalGetEcotaxaAccountsModels(options: PreparedSearchOptions): Promise<SearchResult<EcotaxaAccountResponseModel>> {
        // Can be filtered by 
        const filter_params_restricted: string[] = ["ecotaxa_account_ecopart_user_id", "ecotaxa_account_instance_id", "ecotaxa_account_user_email"]

        // Can be sort_by 
        const sort_param_restricted: string[] = ["ecotaxa_account_expiration_date"]

        return await this.getEcotaxaAccountModels(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    // //TODO MOVE TO SEARCH REPOSITORY
    private async getEcotaxaAccountModels(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<EcotaxaAccountResponseModel>> {
        const unauthorizedParams: string[] = [];
        //TODO move to a search repository
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by => {
            let is_valid = true;
            if (!sort_by_params.includes(sort_by.sort_by)) {
                unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
                is_valid = false;
            }
            if (!order_by_params.includes(sort_by.order_by)) {
                unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter => {
            let is_valid = true;
            if (!filtering_params.includes(filter.field)) {
                unauthorizedParams.push(`Filter field: ${filter.field}`);
                is_valid = false;
            }
            if (!filter_operator_params.includes(filter.operator)) {
                unauthorizedParams.push(`Filter operator: ${filter.operator}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }

        return await this.ecotaxa_accountDataSource.getAll(options);
    }
    async ensureEcotaxaInstanceConsistency(public_project: PublicProjectRequestCreationModel | PublicProjectUpdateModel): Promise<void> {
        const { new_ecotaxa_project, ecotaxa_project_id, ecotaxa_instance_id, ecotaxa_account_id } = public_project;
        // If specified, ecotaxa instance should be valid
        if (ecotaxa_instance_id) {
            const ecotaxa_instance = await this.getOneEcoTaxaInstance(ecotaxa_instance_id);
            if (!ecotaxa_instance) {
                throw new Error("Ecotaxa instance not found.");
            }
        }
        // If new ecotaxa project, ecotaxa instance should be provided
        if (new_ecotaxa_project && !ecotaxa_instance_id) {
            throw new Error("Ecotaxa instance ID is required for a new Ecotaxa project.");
        }
        // If existing ecotaxa project, ecotaxa instance should be provided
        if (!new_ecotaxa_project && ecotaxa_project_id && !ecotaxa_instance_id) {
            throw new Error("Ecotaxa instance ID is required for an existing Ecotaxa project.");
        }
        // If existing ecotaxa project, ecotaxa instance should match the ecotaxa account's instance
        if (!new_ecotaxa_project && ecotaxa_project_id) {
            const ecotaxa_account = await this.getOneEcotaxaAccount(ecotaxa_account_id as number);
            if (!ecotaxa_account) {
                throw new Error("Ecotaxa account not found.");
            }
            if (ecotaxa_account.ecotaxa_account_instance_id !== ecotaxa_instance_id) {
                throw new Error("Mismatch: Ecotaxa instance ID does not match the Ecotaxa account's instance ID.");
            }
        }
    }

    async deleteEcopartUserFromEcotaxaProject(current_project: ProjectResponseModel, project_to_update_model: PublicProjectUpdateModel): Promise<void> {
        const ecotaxa_account_id = project_to_update_model.ecotaxa_account_id as number
        const ecotaxa_instance_id = current_project.ecotaxa_instance_id as number
        const ecotaxa_project_id = current_project.ecotaxa_project_id as number

        // if no linked project, return
        if (!ecotaxa_project_id) return

        // get ecotaxa account
        const ecotaxa_account = await this.getOneEcotaxaAccount(ecotaxa_account_id);
        if (!ecotaxa_account) {
            throw new Error("Ecotaxa account not found");
        }

        // get ecotaxa instance
        const ecotaxa_instance = await this.getOneEcoTaxaInstance(ecotaxa_instance_id);
        if (!ecotaxa_instance) {
            throw new Error("Ecotaxa instance not found");
        }

        // get ecotaxa project
        // TODO if not found delete the link to not block the project?
        const ecotaxa_project = await this.api_get_ecotaxa_project(ecotaxa_instance.ecotaxa_instance_url, ecotaxa_account.ecotaxa_account_token, ecotaxa_project_id)
        if (!ecotaxa_project) {
            throw new Error("EcoTaxa project not found");
        }

        // check that the ecotaxa account is manager in the ecotaxa project
        if (ecotaxa_project.highest_right !== "Manage") throw new Error("Given EcoTaxa account is not manager in the old EcoTaxa project and cannot remove created link. You should manage both old and new EcoTaxa projects");

        // remove the user from the project
        const ecotaxa_project_withour_generic_ecotaxa_user = this.removeEcotaxaGenericAccountFromProject(ecotaxa_instance, ecotaxa_project)

        await this.api_update_ecotaxa_project(ecotaxa_instance.ecotaxa_instance_url, ecotaxa_account.ecotaxa_account_token, ecotaxa_project_withour_generic_ecotaxa_user)
    }
}