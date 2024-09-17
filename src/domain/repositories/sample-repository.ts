
// import { SampleDataSource } from "../../data/interfaces/data-sources/sample-data-source";
// import { InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PublicPrivilege } from "../entities/privilege";
// import { SampleRequestCreationModel, SampleRequestModel, SampleUpdateModel, SampleResponseModel, PublicSampleResponseModel, PublicSampleRequestCreationModel } from "../entities/sample";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
// import { SampleRepository } from "../interfaces/repositories/sample-repository";

import { head } from "shelljs";
import { HeaderSampleModel, PublicHeaderSampleResponseModel } from "../entities/sample";
import { SampleRepository } from "../interfaces/repositories/sample-repository";


import { promises as fs } from 'fs';
import path from 'path';

export class SampleRepositoryImpl implements SampleRepository {

    //sampleDataSource: SampleDataSource

    // // TODO move to a search repository
    // order_by_allow_params: string[] = ["asc", "desc"]
    // filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    // constructor(sampleDataSource: SampleDataSource) {
    //     this.sampleDataSource = sampleDataSource
    // }

    async ensureFolderExists(root_folder_path: string): Promise<void> {
        const folderPath = path.join(root_folder_path);

        try {
            await fs.access(folderPath);
            console.log('Folder exists');
        } catch (error) {
            throw new Error(`Folder does not exist at path: ${folderPath}`);
        }
    }

    async listImportableSamples(root_folder_path: string): Promise<PublicHeaderSampleResponseModel[]> {
        const folderPath = path.join(root_folder_path);
        // read from folderPath/meta/*header*.txt and return the list of samples
        const meta_header_samples = await this.getSamplesFromHeaders(folderPath);

        // read from folderPath/ecodata and return the list of samples
        const ecodata_samples = await this.getSamplesFromEcodata(folderPath);

        // flag qc samples to flase if not in both lists, and add qc message
        const samples: PublicHeaderSampleResponseModel[] = [];
        for (const sample of meta_header_samples) {
            samples.push({
                sample_name: sample.filename,
                raw_file_name: sample.filename,
                station_id: sample.stationId,
                first_image: sample.firstImage,
                last_image: sample.endImg,
                comment: sample.comment,
                qc_lvl1: ecodata_samples.includes(sample.filename) ? true : false,
                qc_lvl1_comment: ecodata_samples.includes(sample.filename) ? '' : 'Sample not found in ecodata folder'
            });
        }
        return samples;
    }

    // Function to read and return samples from header.txt files
    async getSamplesFromHeaders(folderPath: string): Promise<HeaderSampleModel[]> {
        const samples: HeaderSampleModel[] = [];
        try {
            const header_path = path.join(folderPath, 'meta');
            const files = await fs.readdir(header_path);
            console.log('header files', files);
            for (const file of files) {
                if (file.includes('header') && file.endsWith('.txt')) {
                    const filePath = path.join(header_path, file);
                    const content = await fs.readFile(filePath, 'utf8');

                    const lines = content.trim().split('\n');
                    for (let i = 1; i < lines.length; i++) {
                        samples.push(this.getSampleFromHeaderLine(lines[i]));
                    }
                }
            }
        } catch (err) {
            throw new Error(`Error reading files: ${err.message}`);
        }

        return samples;
    }

    getSampleFromHeaderLine(line: string): HeaderSampleModel {
        console.log('line', line);
        const fields = line.split(';');

        const sample: HeaderSampleModel = {
            cruise: fields[0],
            ship: fields[1],
            filename: fields[2],
            profileId: fields[3],
            bottomDepth: fields[4],
            ctdRosetteFilename: fields[5],
            latitude: fields[6],
            longitude: fields[7],
            firstImage: fields[8],
            volImage: fields[9],
            aa: fields[10],
            exp: fields[11],
            dn: fields[12],
            windDir: fields[13],
            windSpeed: fields[14],
            seaState: fields[15],
            nebulousness: fields[16],
            comment: fields[17],
            endImg: fields[18],
            yoyo: fields[19],
            stationId: fields[20],
            sampleType: fields[21],
            integrationTime: fields[22],
            argoId: fields[23],
            pixelSize: fields[24],
            sampleDateTime: fields[25]
        };
        return sample;
    }

    // Function to read and return samples from ecodata folder names
    async getSamplesFromEcodata(folderPath: string): Promise<string[]> {
        const samples: string[] = [];
        try {
            const files = await fs.readdir(path.join(folderPath, 'ecodata'));

            for (const file of files) {
                samples.push(file);
            }
        } catch (err) {
            throw new Error(`Error reading files: ${err.message}`);
        }

        return samples;
    }



    // async createSample(sample: SampleRequestCreationModel): Promise<number> {
    //     const result = await this.sampleDataSource.create(sample)
    //     return result;
    // }

    // async getSample(sample: SampleRequestModel): Promise<SampleResponseModel | null> {
    //     const result = await this.sampleDataSource.getOne(sample)
    //     return result;
    // }

    // async deleteSample(sample: SampleRequestModel): Promise<number> {
    //     const result = await this.sampleDataSource.deleteOne(sample)
    //     return result;
    // }

    // private async updateSample(sample: SampleUpdateModel, params: string[]): Promise<number> {
    //     const filteredSample: Partial<SampleUpdateModel> = {};
    //     const unauthorizedParams: string[] = [];

    //     // Filter the sample object based on authorized parameters
    //     Object.keys(sample).forEach(key => {
    //         if (key === 'sample_id') {
    //             filteredSample[key] = sample[key];
    //         } else if (params.includes(key)) {
    //             filteredSample[key] = sample[key];
    //         } else {
    //             unauthorizedParams.push(key);
    //         }
    //     });

    //     // If unauthorized params are found, throw an error
    //     if (unauthorizedParams.length > 0) {
    //         throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
    //     }
    //     // If there are valid parameters, update the sample
    //     if (Object.keys(filteredSample).length <= 1) {
    //         throw new Error('Please provide at least one valid parameter to update');
    //     }
    //     const updatedSampleCount = await this.sampleDataSource.updateOne(filteredSample as SampleUpdateModel);
    //     return updatedSampleCount;
    // }

    // async standardUpdateSample(sample: SampleUpdateModel): Promise<number> {
    //     const params_restricted = ["sample_id", "root_folder_path", "sample_title", "sample_acronym", "sample_description", "sample_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number"]
    //     const updated_sample_nb = await this.updateSample(sample, params_restricted)
    //     return updated_sample_nb
    // }

    // async standardGetSamples(options: PreparedSearchOptions): Promise<SearchResult<SampleResponseModel>> {
    //     // Can be filtered by 
    //     const filter_params_restricted = ["sample_id", "root_folder_path", "sample_title", "sample_acronym", "sample_description", "sample_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number", "sample_creation_date"]

    //     // Can be sort_by 
    //     const sort_param_restricted = ["sample_id", "root_folder_path", "sample_title", "sample_acronym", "sample_description", "sample_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number", "sample_creation_date"]

    //     return await this.getSamples(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    // }

    // //TODO MOVE TO SEARCH REPOSITORY
    // private async getSamples(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<SampleResponseModel>> {
    //     const unauthorizedParams: string[] = [];
    //     //TODO move to a search repository
    //     // Filter options.sort_by by sorting params 
    //     options.sort_by = options.sort_by.filter(sort_by => {
    //         let is_valid = true;
    //         if (!sort_by_params.includes(sort_by.sort_by)) {
    //             unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
    //             is_valid = false;
    //         }
    //         if (!order_by_params.includes(sort_by.order_by)) {
    //             unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
    //             is_valid = false;
    //         }
    //         return is_valid;
    //     });

    //     //TODO move to a search repository
    //     // Filter options.filters by filtering params
    //     options.filter = options.filter.filter(filter => {
    //         let is_valid = true;
    //         if (!filtering_params.includes(filter.field)) {
    //             unauthorizedParams.push(`Filter field: ${filter.field}`);
    //             is_valid = false;
    //         }
    //         if (!filter_operator_params.includes(filter.operator)) {
    //             unauthorizedParams.push(`Filter operator: ${filter.operator}`);
    //             is_valid = false;
    //         }
    //         return is_valid;
    //     });

    //     //TODO move to a search repository
    //     if (unauthorizedParams.length > 0) {
    //         throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
    //     }

    //     return await this.sampleDataSource.getAll(options);
    // }



}