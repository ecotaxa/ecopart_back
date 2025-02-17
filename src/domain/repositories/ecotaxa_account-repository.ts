import { EcotaxaAccountDataSource } from "../../data/interfaces/data-sources/ecotaxa_account-data-source";
import { PublicEcotaxaAccountRequestCreationModel, EcotaxaAccountModel, EcotaxaAccountRequestCreationModel, EcotaxaAccountUser, EcotaxaInstanceModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel } from "../entities/ecotaxa_account";
import { PreparedSearchOptions } from "../entities/search";
// import { InstrumentModelRequestModel, InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { EcotaxaAccountRepository } from "../interfaces/repositories/ecotaxa_account-repository";

export class EcotaxaAccountRepositoryImpl implements EcotaxaAccountRepository {
    ecotaxa_accountDataSource: EcotaxaAccountDataSource

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    constructor(ecotaxa_accountDataSource: EcotaxaAccountDataSource) {
        this.ecotaxa_accountDataSource = ecotaxa_accountDataSource
    }
    async connectToEcotaxaInstance(ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<EcotaxaAccountModel> {
        const instance_url = await this.getInstanceURL(ecotaxa_account_to_create.ecotaxa_instance_id)

        // Connect to the ecotaxa instance login api
        const ecotaxa_token = await this.api_ecotaxa_login(instance_url, ecotaxa_account_to_create)

        const expiration_date = new Date();
        expiration_date.setDate(expiration_date.getDate() + 30);

        const ecotaxa_user_name = (await this.api_ecotaxa_me(instance_url, ecotaxa_token)).name

        // Return the ecotaxa account model
        return {
            ecotaxa_token: ecotaxa_token,
            ecotaxa_user_name: ecotaxa_user_name,
            ecotaxa_expiration_date: expiration_date.toISOString()
        }
    }
    async createEcotaxaAccount(private_ecotaxa_account_to_create: EcotaxaAccountRequestCreationModel): Promise<number> {
        return await this.ecotaxa_accountDataSource.create(private_ecotaxa_account_to_create);
    }
    async getOneEcotaxaAccount(ecotaxa_account_id: number): Promise<EcotaxaAccountResponseModel | null> {
        const ecotaxa_account = await this.ecotaxa_accountDataSource.getOne(ecotaxa_account_id);
        return ecotaxa_account;
    }
    formatEcotaxaAccountResponse(ecotaxa_account: EcotaxaAccountResponseModel): EcotaxaAccountModel {
        return {
            ecotaxa_token: ecotaxa_account.ecotaxa_account_token,
            ecotaxa_user_name: ecotaxa_account.ecotaxa_account_user_name,
            ecotaxa_expiration_date: ecotaxa_account.ecotaxa_account_expiration_date
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
            throw new Error(`HTTP Error: ${response.status}`);
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
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        return data as EcotaxaAccountUser;
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
}