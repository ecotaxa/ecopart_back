
import { SampleDataSource } from "../../data/interfaces/data-sources/sample-data-source";
// import { InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PublicPrivilege } from "../entities/privilege";
// import { SampleRequestCreationModel, SampleRequestModel, SampleUpdateModel, SampleResponseModel, PublicHeaderSampleResponseModel, PublicSampleRequestCreationModel } from "../entities/sample";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
// import { SampleRepository } from "../interfaces/repositories/sample-repository";

import { ComputeVignettesModel, HeaderSampleModel, MetadataIniSampleModel, MinimalSampleRequestModel, PublicHeaderSampleResponseModel, PublicSampleModel, SampleIdModel, SampleRequestCreationModel, SampleRequestModel, SampleTypeModel, SampleTypeRequestModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel } from "../entities/sample";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { SampleRepository } from "../interfaces/repositories/sample-repository";


import { promises as fs } from 'fs';
//import fs from 'fs'; // Correct import for `createReadStream`
//import { parse, Options } from 'csv-parse'; // Use named import for `parse`

import path from 'path';
import yauzl from 'yauzl';



export class SampleRepositoryImpl implements SampleRepository {

    sampleDataSource: SampleDataSource
    DATA_STORAGE_FS_STORAGE: string

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    constructor(sampleDataSource: SampleDataSource, DATA_STORAGE_FS_STORAGE: string) {
        this.sampleDataSource = sampleDataSource
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
    }

    async formatSampleToImport(base_sample: Partial<SampleRequestCreationModel>, instrument_model: string): Promise<SampleRequestCreationModel> {

        const file_system_storage_project_folder = this.DATA_STORAGE_FS_STORAGE + base_sample.project_id || '';

        // foreach sample in samples_names_to_import
        const sample_to_return = await this.getSampleFromFsStorage(file_system_storage_project_folder, base_sample, instrument_model);
        return sample_to_return;
    }

    async getSampleFromFsStorage(file_system_storage_project_folder: string, base_sample: Partial<SampleRequestCreationModel>, instrument_model: string): Promise<SampleRequestCreationModel> {
        let sample_fss = {};

        if (instrument_model.startsWith('UVP6')) {
            // read from file_system_storage_project_folder/ecodata and return the list of samples
            sample_fss = await this.getSampleFromFsStorageUVP6(file_system_storage_project_folder, base_sample.sample_name as string);
        }
        // else if (instrument_model.startsWith('UVP5')) {
        //     // read from file_system_storage_project_folder/work and return the list of samples
        //     sample_fss = await this.getSampleFromFsStorageUVP5(file_system_storage_project_folder, base_sample.sample_name as string);
        // }
        const sample = this.constructSampleFromBaseAndFsStorage(sample_fss, base_sample);

        return sample;
    }

    // async getSampleFromFsStorageUVP5(file_system_storage_project_folder: string, sample_name: string): Promise<SampleRequestCreationModel> {

    // const sample: Partial<SampleRequestCreationModel> = {
    //     sample_name: ini_content.sample_metadata['profileid'] as string,
    //     comment: ini_content.sample_metadata['comment'] as string,
    //     instrument_serial_number: ini_content.HW_CONF['Camera_ref'] as string,
    //     optional_structure_id: ini_content.sample_metadata['argoid'] as string,
    //     max_pressure: this.computeMaxPressure(),//TODO à calculer
    //     integration_time: ini_content.sample_metadata['integrationtime'] as number,
    //     station_id: ini_content.sample_metadata['stationid'] as string,
    //     sampling_date: ini_content.sample_metadata['sampledatetime'] as string,
    //     latitude: this.computeLatitude(ini_content.sample_metadata['latitude'] as number),
    //     longitude: this.computeLongitude(ini_content.sample_metadata['longitude'] as number),
    //     wind_direction: ini_content.sample_metadata['winddir'] as number,
    //     wind_speed: ini_content.sample_metadata['windspeed'] as number,
    //     sea_state: ini_content.sample_metadata['seastate'] as string,
    //     nebulousness: ini_content.sample_metadata['nebuloussness'] as number,
    //     bottom_depth: ini_content.sample_metadata['bottom_depth'] as number,
    //     instrument_operator_email: ini_content.HW_CONF['Operator_email'] as string,
    //     filename: ini_content.sample_metadata['filename'] as string,
    //     filter_first_image: ini_content.sample_metadata['firstimage'] as string,
    //     filter_last_image: ini_content.sample_metadata['endimg'] as string,
    //     instrument_settings_acq_gain: ini_content.ACQ_CONF['Gain'] as number,
    //     instrument_settings_acq_description: ini_content['???'] as string || "#TODO",//TODO seulement pour l'uvp5
    //     instrument_settings_acq_task_type: ini_content['???'] as string || "#TODO",// TODO seulement pour l'uvp5
    //     sample_type_id: this.getSampleTypeFromLetter(ini_content.sample_metadata['sampletype']), //TODO à calculer checket si T ou D si non erreur
    //     instrument_settings_acq_choice: ini_content['???'] as string || "#TODO",//TODO seulement pour l'uvp5
    //     instrument_settings_acq_disk_type: ini_content['???'] as string || "#TODO", // TODO seulement pour l'uvp5
    //     instrument_settings_acq_appendices_ratio: ini_content.ACQ_CONF['Appendices_ratio'] as number,
    //     instrument_settings_acq_xsize: ini_content['???'] as number || -1,//TODO seulement pour l'uvp5 (fichier uvp5_configurationdata.txt)
    //     instrument_settings_acq_ysize: ini_content['???'] as number || -1,//TODO seulement pour l'uvp5 (fichier uvp5_configurationdata.txt)
    //     instrument_settings_acq_erase_border: ini_content['???'] as number || -1,//TODO seulement pour l'uvp5 
    //     instrument_settings_acq_threshold: ini_content.HW_CONF['Threshold'] as number,
    //     instrument_settings_process_datetime: "ini_content['???'] as string || ",//TODO seulement pour l'uvp5 
    //     instrument_settings_process_gamma: this.getGammaForUVP6(),//TODO à aller chercher image.zip compute_vignette.txt
    //     instrument_settings_images_post_process: "uvpapp",
    //     instrument_settings_aa: ini_content.HW_CONF['Aa'] as number,
    //     instrument_settings_exp: ini_content.HW_CONF['Exp'] as number,
    //     instrument_settings_image_volume_l: ini_content.HW_CONF['Image_volume'] as number,
    //     instrument_settings_pixel_size_mm: ini_content.HW_CONF['Pixel_Size'] as number,
    //     instrument_settings_depth_offset_m: ini_content.HW_CONF['Pressure_offset'] as number,
    //     instrument_settings_particle_minimum_size_pixels: ini_content['??'] as number || -1,//TODO seulement pour l'uvp5 
    //     instrument_settings_vignettes_minimum_size_pixels: ini_content.ACQ_CONF['??'] as number, //TODO seulement pour l'uvp5 
    //     instrument_settings_particle_minimum_size_esd: ini_content.ACQ_CONF['Limit_lpm_detection_size'] as number || -1,//TODO seulement pour l'uvp6 
    //     instrument_settings_vignettes_minimum_size_esd: ini_content.ACQ_CONF['Vignetting_lower_limit_size'] as number, //TODO seulement pour l'uvp6 
    //     instrument_settings_acq_shutter_speed: ini_content.HW_CONF['???'] as number, // UVP5SD 
    //     instrument_settings_acq_exposure: ini_content['???'] as number || -1,// TODO UVP5HD 
    //     instrument_settings_acq_shutter: ini_content['Shutter'] as number || -1,// TODO UVP6,
    // }
    ////////////////////////////////
    //     //read from tsv
    //     const tsvPath = path.join(file_system_storage_project_folder, "work", sample_name, `ecotaxa_${sample_name}.tsv`);
    //     type RowType = {
    //         name: string;
    //         age: number;
    //         city: string;
    //     };

    //     const options: Options = {
    //         delimiter: '\t',
    //         columns: true,
    //     };
    //     let rowCount = 0;
    //     const rows: RowType[] = []; // Array to store the rows

    //     return new Promise((resolve, reject) => {
    //         const stream = fs.createReadStream(tsvPath)
    //             .pipe(parse(options))
    //             .on('data', (row: RowType) => {
    //                 if (rowCount < 2) {
    //                     console.log('Row:', row);
    //                     rows.push(row); // Add the row to the array
    //                     rowCount++;
    //                 } else {
    //                     // Stop reading further data once two rows are processed
    //                     stream.destroy();
    //                 }
    //             })
    //             .on('end', () => {
    //                 console.log('File processing completed.');
    //                 resolve(rows); // Return the array of rows
    //             })
    //             .on('error', (err) => {
    //                 console.error('Error reading the file:', err);
    //                 reject(err);
    //             });
    //     });
    // }

    async getSampleFromFsStorageUVP6(file_system_storage_project_folder: string, sample_name: string): Promise<Partial<SampleRequestCreationModel>> {

        /***
         *  
            fetch data from metadata.ini:
                *****
            process already fetch data:
                latitude: this.computeLatitude(ini_content.sample_metadata['latitude'] as number),
                longitude: this.computeLongitude(ini_content.sample_metadata['longitude'] as number),

                sample_type_id: this.getSampleTypeFromLetter(ini_content.sample_metadata['sampletype']), //TODO à calculer checket si T ou D si non erreur

            go to another file to get the data:  
                max_pressure: this.computeMaxPressure(),//TODO à calculer
                instrument_settings_process_gamma: this.getGammaForUVP6(),//TODO à aller chercher image.zip compute_vignette.txt    

         * 
         ***/
        // Complete/reprocess the sample object
        // Get sample info from metadata.ini
        const sample_metadata_ini = await this.getSampleFromMetadataIni(file_system_storage_project_folder, sample_name);
        // Process sample_type_id
        const sample_type_id = await this.computeSampleTypeId(sample_metadata_ini);
        // Process latitude and longitude
        const coords = this.computeLatitudeAndLongitude(sample_metadata_ini);

        // Compute max_pressure
        const max_pressure = await this.computeMaxPressure(sample_metadata_ini, file_system_storage_project_folder, sample_name);
        // Get instrument_settings_process_gamma
        const instrument_settings_process_gamma = await this.getInstrumentSettingsProcessGamma(sample_metadata_ini, file_system_storage_project_folder, sample_name);


        // Construct the sample object
        delete (sample_metadata_ini as any).sampleType;
        delete (sample_metadata_ini as any).latitude_raw;
        delete (sample_metadata_ini as any).longitude_raw;

        const sample_to_return: Partial<SampleRequestCreationModel> = {
            ...sample_metadata_ini,
            sample_type_id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            max_pressure,
            instrument_settings_process_gamma
        };
        return sample_to_return;
    }

    async getInstrumentSettingsProcessGamma(sample: MetadataIniSampleModel, file_system_storage_project_folder: string, sample_name: string): Promise<number | undefined> {
        // todo if no vignettes generated return undefined
        if (sample.comment === 'no vignettes generated') {
            return undefined;
        }
        // else return the gamma
        const gamma = (await this.readComputeVignettes(file_system_storage_project_folder, sample_name)).gamma;
        return gamma;
    }

    async readComputeVignettes(file_system_storage_project_folder: string, sample_name: string): Promise<ComputeVignettesModel> {
        return new Promise((resolve, reject) => {
            // Define the path to the .zip file based on the project folder and sample name
            const zipPath = path.join(file_system_storage_project_folder, sample_name, `${sample_name}_Images.zip`);

            // Open the zip file without extracting it to disk
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) {
                    return reject(err || new Error('Failed to open zip file'));
                }

                // Start reading entries in the zip file
                zipfile.readEntry();

                // Handle each entry found in the zip file
                zipfile.on('entry', (entry) => {
                    // Check if the current entry is the metadata.ini file
                    if (entry.fileName === 'compute_vignette.txt') {
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err || !readStream) {
                                return reject(err || new Error('Failed to open read stream'));
                            }

                            let data = '';
                            // Collect data chunks from the read stream
                            readStream.on('data', (chunk) => {
                                data += chunk;
                            });

                            // When the read stream ends, parse the collected data manually
                            readStream.on('end', () => {
                                try {
                                    const parsedData = this.parseComputeVignettes(data);
                                    resolve(parsedData);
                                } catch (parseError) {
                                    reject(parseError);
                                }
                            });
                        });
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('end', () => {
                    reject(new Error('metadata.ini not found in zip file'));
                });
            });
        });
    }

    parseComputeVignettes(data: string): ComputeVignettesModel {
        const result: Partial<ComputeVignettesModel> = {};
        const lines = data.split('\n');

        for (const line of lines) {
            const [key, value] = line.split('=').map(part => part.trim());

            switch (key) {
                case 'gamma':
                    result.gamma = parseFloat(value);
                    break;
                case 'invert':
                    result.invert = value.toLowerCase();
                    break;
                case 'scalebarsize_mm':
                    result.scalebarsize_mm = parseFloat(value);
                    break;
                case 'keeporiginal':
                    result.keeporiginal = value.toLowerCase();
                    break;
                case 'fontcolor':
                    result.fontcolor = value.toLowerCase();
                    break;
                case 'fontheight_px':
                    result.fontheight_px = parseInt(value)
                    break;
                case 'footerheight_px':
                    result.footerheight_px = parseInt(value)
                    break;
                case 'scale':
                    result.scale = parseFloat(value);
                    break;
                case 'Pixel_Size':
                    result.Pixel_Size = parseFloat(value);
                    break;
                default:
                    break;
            }
        }

        return result as ComputeVignettesModel;
    }


    computeMaxPressure(sample: MetadataIniSampleModel, file_system_storage_project_folder: string, sample_name: string): number {
        console.log(sample, file_system_storage_project_folder, sample_name)
        return 0;
    }

    computeLatitudeAndLongitude(sample: MetadataIniSampleModel): { latitude: number, longitude: number } {
        // Compute latitude and longitude
        const latitude = this.convTextDegreeDotMinuteToDecimalDegree(sample.latitude_raw, 'uvp6');
        const longitude = this.convTextDegreeDotMinuteToDecimalDegree(sample.longitude_raw, 'uvp6');

        return { latitude, longitude };
    }


    // Convert a latitude or longitude string to a decimal degree float.
    // Possible formats:
    // DD°MM SS
    // DD.MMMMM: MMMMM = Minutes /100, between 0.0 and 0.6 (historical UVP format)
    // DD.FFFFF: FFFFF = Fraction of degrees
    convTextDegreeDotMinuteToDecimalDegree(v: string, instrumtype: string): number {

        const degreeMinuteSecondRegex = /(-?\d+)°(\d+) (\d+)/;
        const match = degreeMinuteSecondRegex.exec(v);

        if (match) { // Format DDD°MM SSS
            const degrees = parseFloat(match[1]);
            const minutes = parseFloat(match[2]);
            const seconds = parseFloat(match[3]);

            const minuteFraction = minutes + seconds / 60;
            const decimalDegrees = degrees + Math.sign(degrees) * (minuteFraction / 60);
            return parseFloat(decimalDegrees.toFixed(5));
        } else {
            if (instrumtype === 'uvp5') {
                const floatValue = this._ToFloat(v);
                const integerPart = Math.floor(floatValue);
                const fractionPart = floatValue - integerPart;
                return parseFloat((integerPart + fractionPart / 0.6).toFixed(5));
            } else {
                return parseFloat(this._ToFloat(v).toFixed(5));
            }
        }
    }

    // Helper function to convert a string to float
    _ToFloat(v: string): number {
        return parseFloat(v);
    }


    async computeSampleTypeId(sample: MetadataIniSampleModel): Promise<number> {
        let sample_type_id: number | undefined;

        //throw error if unknown sample type
        if (sample.sampleType === undefined) throw new Error("Undefined sample type");

        // Compute sample_type_id
        if (sample.sampleType == "T") {
            sample_type_id = (await this.getSampleType({ sample_type_label: "Time" }))?.sample_type_id;
        } else if (sample.sampleType == "D") {
            sample_type_id = (await this.getSampleType({ sample_type_label: "Depth" }))?.sample_type_id;
        } else throw new Error("Unknown sample type");

        if (sample_type_id === undefined) throw new Error("Sample type not found");
        return sample_type_id
    }

    getSampleFromMetadataIni(file_system_storage_project_folder: string, sample_name: string): Promise<MetadataIniSampleModel> {
        return new Promise((resolve, reject) => {
            // Define the path to the .zip file based on the project folder and sample name
            const zipPath = path.join(file_system_storage_project_folder, sample_name, `${sample_name}_Particule.zip`);

            // Open the zip file without extracting it to disk
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) {
                    return reject(err || new Error('Failed to open zip file'));
                }

                // Start reading entries in the zip file
                zipfile.readEntry();

                // Handle each entry found in the zip file
                zipfile.on('entry', (entry) => {
                    // Check if the current entry is the metadata.ini file
                    if (entry.fileName === 'metadata.ini') {
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err || !readStream) {
                                return reject(err || new Error('Failed to open read stream'));
                            }

                            let data = '';
                            // Collect data chunks from the read stream
                            readStream.on('data', (chunk) => {
                                data += chunk;
                            });

                            // When the read stream ends, parse the collected data manually
                            readStream.on('end', () => {
                                try {
                                    const parsedData = this.parseIniContent(data);
                                    resolve(parsedData);
                                } catch (parseError) {
                                    reject(parseError);
                                }
                            });
                        });
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('end', () => {
                    reject(new Error('metadata.ini not found in zip file'));
                });
            });
        });
    }

    parseIniContent(data: string): MetadataIniSampleModel {
        const ini_content: any = {};
        let currentSection: string | null = null;

        // Split the data into lines and process each line
        const lines = data.split(/\r?\n/);
        lines.forEach((line) => {
            line = line.trim();

            // Ignore empty lines or comments
            if (!line || line.startsWith(';') || line.startsWith('#')) {
                return;
            }

            // Check if the line is a section header
            if (line.startsWith('[') && line.endsWith(']')) {
                currentSection = line.slice(1, -1).trim();
                ini_content[currentSection] = {};
            }
            // Otherwise, it's a key-value pair
            else if (currentSection) {
                const [key, value] = line.split('=').map((part) => part.trim());
                if (key) {
                    // Convert the value to a number if possible, otherwise keep as string
                    (ini_content[currentSection] as any)[key] = isNaN(Number(value)) ? value : Number(value);
                }
            }
        });

        const sample: MetadataIniSampleModel = {
            sample_name: ini_content.sample_metadata['profileid'] as string,
            comment: ini_content.sample_metadata['comment'] as string,
            instrument_serial_number: ini_content.HW_CONF['Camera_ref'] as string,
            optional_structure_id: ini_content.sample_metadata['argoid'] as string,
            integration_time: ini_content.sample_metadata['integrationtime'] as number,
            station_id: ini_content.sample_metadata['stationid'] as string,
            sampling_date: ini_content.sample_metadata['sampledatetime'] as string,
            wind_direction: ini_content.sample_metadata['winddir'] as number,
            wind_speed: ini_content.sample_metadata['windspeed'] as number,
            sea_state: ini_content.sample_metadata['seastate'] as string,
            nebulousness: ini_content.sample_metadata['nebuloussness'] as number,
            bottom_depth: ini_content.sample_metadata['bottom_depth'] as number,
            instrument_operator_email: ini_content.HW_CONF['Operator_email'] as string,
            filename: ini_content.sample_metadata['filename'] as string,
            filter_first_image: ini_content.sample_metadata['firstimage'] as string,
            filter_last_image: ini_content.sample_metadata['endimg'] as string,
            instrument_settings_acq_gain: ini_content.ACQ_CONF['Gain'] as number,
            instrument_settings_acq_description: undefined,
            instrument_settings_acq_task_type: undefined,
            instrument_settings_acq_choice: undefined,
            instrument_settings_acq_disk_type: undefined,
            instrument_settings_acq_appendices_ratio: ini_content.ACQ_CONF['Appendices_ratio'] as number,
            instrument_settings_acq_xsize: undefined,
            instrument_settings_acq_ysize: undefined,
            instrument_settings_acq_erase_border: undefined,
            instrument_settings_acq_threshold: ini_content.HW_CONF['Threshold'] as number,
            instrument_settings_process_datetime: undefined,
            instrument_settings_images_post_process: "uvpapp",
            instrument_settings_aa: ini_content.HW_CONF['Aa'] as number,
            instrument_settings_exp: ini_content.HW_CONF['Exp'] as number,
            instrument_settings_image_volume_l: ini_content.HW_CONF['Image_volume'] as number,
            instrument_settings_pixel_size_mm: ini_content.HW_CONF['Pixel_Size'] as number,
            instrument_settings_depth_offset_m: ini_content.HW_CONF['Pressure_offset'] as number,
            instrument_settings_particle_minimum_size_pixels: undefined,
            instrument_settings_vignettes_minimum_size_pixels: undefined,
            instrument_settings_particle_minimum_size_esd: ini_content.ACQ_CONF['Limit_lpm_detection_size'] as number,
            instrument_settings_vignettes_minimum_size_esd: ini_content.ACQ_CONF['Vignetting_lower_limit_size'] as number,
            instrument_settings_acq_shutter_speed: undefined,
            instrument_settings_acq_exposure: undefined,
            instrument_settings_acq_shutter: undefined,

            // these will be reprocessed
            latitude_raw: ini_content.sample_metadata['latitude'],
            longitude_raw: ini_content.sample_metadata['longitude'],

            sampleType: ini_content.sample_metadata['sampletype']
        }

        return sample;
    }

    constructSampleFromBaseAndFsStorage(sample_fss: Partial<SampleRequestCreationModel>, base_sample: Partial<SampleRequestCreationModel>): SampleRequestCreationModel {
        const sample: SampleRequestCreationModel = { ...base_sample, ...sample_fss } as SampleRequestCreationModel;
        return sample;
    }

    async createSample(sample: SampleRequestCreationModel): Promise<number> {
        const result = await this.sampleDataSource.createOne(sample)
        return result;
    }

    async createManySamples(samples: SampleRequestCreationModel[]): Promise<number[]> {
        const result = await this.sampleDataSource.createMany(samples)
        return result;
    }

    async ensureFolderExists(root_folder_path: string): Promise<void> {
        const folderPath = path.join(root_folder_path);

        try {
            await fs.access(folderPath);
        } catch (error) {
            throw new Error(`Folder does not exist at path: ${folderPath}`);
        }
    }

    async listImportableSamples(root_folder_path: string, instrument_model: string, dest_folder: string, project_id: number): Promise<PublicHeaderSampleResponseModel[]> {
        // List importable samples from root_folder_path
        let samples: PublicHeaderSampleResponseModel[] = [];
        const folderPath = path.join(root_folder_path);
        // Read from folderPath/meta/*header*.txt and return the list of samples
        const meta_header_samples = await this.getSamplesFromHeaders(folderPath);

        if (instrument_model.startsWith('UVP6')) {
            // Read from folderPath/ecodata and return the list of samples
            const samples_ecodata = await this.getSamplesFromEcodata(folderPath);
            samples = await this.setupSamples(meta_header_samples, samples_ecodata, "ecodata");

        } else if (instrument_model.startsWith('UVP5')) {
            // Read from folderPath/work and return the list of samples
            const samples_work = await this.getSamplesFromWork(folderPath);
            samples = await this.setupSamples(meta_header_samples, samples_work, "work");
        }


        // Filter samples that are not already in the project folder 
        const fs_imported_samples_name = await this.getSamplesFromFsStorage(dest_folder);
        const fs_filtered_samples = samples.filter(sample => {
            const existingSample = fs_imported_samples_name.includes(sample.sample_name);
            return !existingSample; // keep if sample is not found
        });


        // Filter samples that are not already in the database 
        const options: PreparedSearchOptions = {
            filter: [
                { field: 'project_id', operator: '=', value: project_id }
            ],
            sort_by: [

            ],
            page: 1,
            limit: 10000000
        }

        const db_imported_samples_name = (await this.sampleDataSource.getAll(options)).items.map(sample => sample.sample_name);

        const db_fs_filtered_samples = fs_filtered_samples.filter(sample => {
            const existingSample = db_imported_samples_name.includes(sample.sample_name);
            return !existingSample; // keep if sample is not found
        });

        return db_fs_filtered_samples;
    }

    async getSamplesFromFsStorage(folderPath: string): Promise<string[]> {
        // list folders names in folderPath
        const samples: string[] = [];
        try {
            const files = await fs.readdir(folderPath);

            for (const file of files) {
                samples.push(file);
            }
        } catch (err) {
            throw new Error(`Error reading files: ${err.message}`);
        }
        return samples;
    }

    // Function to setup samples
    async setupSamples(meta_header_samples: HeaderSampleModel[], samples: string[], folder: string): Promise<PublicHeaderSampleResponseModel[]> {
        // Flag qc samples to flase if not in both lists, and add qc message
        const samples_response: PublicHeaderSampleResponseModel[] = [];
        for (const sample of meta_header_samples) {
            samples_response.push({
                sample_name: sample.profileId,
                raw_file_name: sample.filename,
                station_id: sample.stationId,
                first_image: sample.firstImage,
                last_image: sample.endImg,
                comment: sample.comment,
                qc_lvl1: samples.includes(sample.profileId) ? true : false,
                qc_lvl1_comment: samples.includes(sample.profileId) ? '' : 'Sample not found in ' + folder + ' folder'
            });
        }
        return samples_response;
    }
    // Function to read and return samples from header.txt files
    async getSamplesFromHeaders(folderPath: string): Promise<HeaderSampleModel[]> {
        const samples: HeaderSampleModel[] = [];
        try {
            const header_path = path.join(folderPath, 'meta');
            const files = await fs.readdir(header_path);
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
        const fields = line.split(';');

        const sample: HeaderSampleModel = {
            cruise: fields[0],
            ship: fields[1],
            filename: fields[2],
            profileId: fields[3],
            bottomDepth: parseFloat(fields[4]),
            ctdRosetteFilename: fields[5],
            latitude: fields[6],
            longitude: fields[7],
            firstImage: parseFloat(fields[8]),
            volImage: parseFloat(fields[9]),
            aa: parseFloat(fields[10]),
            exp: parseFloat(fields[11]),
            dn: parseFloat(fields[12]),
            windDir: parseFloat(fields[13]),
            windSpeed: parseFloat(fields[14]),
            seaState: fields[15],
            nebulousness: parseFloat(fields[16]),
            comment: fields[17],
            endImg: parseFloat(fields[18]),
            yoyo: fields[19],
            stationId: fields[20],
            sampleType: fields[21],
            integrationTime: parseFloat(fields[22]),
            argoId: fields[23],
            pixelSize: parseFloat(fields[24]),
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

    // Function to read and return samples from work folder names
    async getSamplesFromWork(folderPath: string): Promise<string[]> {
        const samples: string[] = [];
        try {
            const files = await fs.readdir(path.join(folderPath, 'work'));

            for (const file of files) {
                samples.push(file);
            }
        } catch (err) {
            throw new Error(`Error reading files: ${err.message}`);
        }

        return samples;
    }
    async ensureSampleFolderDoNotExists(samples_names_to_import: string[], dest_folder: string): Promise<void> {
        // Ensure that none of the sample folders already exist
        for (const sample of samples_names_to_import) {
            const destPath = path.join(dest_folder, sample);
            try {
                await fs.access(destPath);
                throw new Error(`Sample folder already exists: ${destPath}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Do nothing, the folder does not exist
                } else {
                    // Throw other types of errors, e.g., permission issues
                    throw error;
                }
            }
        }
    }

    async copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void> {

        const base_folder = path.join(__dirname, '..', '..', '..');
        // Ensure that non of the samples folder already exists
        await this.ensureSampleFolderDoNotExists(samples_names_to_import, path.join(base_folder, dest_folder));

        // Ensure destination folder exists
        await fs.mkdir(path.join(base_folder, dest_folder), { recursive: true });

        // Iterate over each sample name and copy it
        for (const sample of samples_names_to_import) {
            const sourcePath = path.join(base_folder, source_folder, sample);
            const destPath = path.join(base_folder, dest_folder, sample);

            // Copy the sample folder recurcively from source to destination
            await fs.cp(sourcePath, destPath, { recursive: true, errorOnExist: true });
        }
    }

    async deleteSamplesFromImportFolder(dest_folder: string, samples_names_to_import: string[]): Promise<void> {
        const base_folder = path.join(__dirname, '..', '..', '..');
        // Iterate over each sample name and delete it
        for (const sample of samples_names_to_import) {
            const destPath = path.join(base_folder, dest_folder, sample);

            // Delete the sample folder recurcively from destination
            await fs.rm(destPath, { recursive: true, force: true });
        }
    }



    // async createSample(sample: SampleRequestCreationModel): Promise<number> {
    //     const result = await this.sampleDataSource.create(sample)
    //     return result;
    // }

    async getSample(sample: SampleRequestModel): Promise<PublicSampleModel | null> {
        // Clean the sample to keep only sample_id, sample_name, project_id if they are defined
        const cleaned_sample: MinimalSampleRequestModel = {};

        if (sample.sample_id !== undefined) cleaned_sample.sample_id = sample.sample_id;
        if (sample.sample_name !== undefined) cleaned_sample.sample_name = sample.sample_name;
        if (sample.project_id !== undefined) cleaned_sample.project_id = sample.project_id;

        // Get the result from the data source
        const result = await this.sampleDataSource.getOne(cleaned_sample);

        return result;
    }

    async deleteSample(sample: SampleIdModel): Promise<number> {
        const result = await this.sampleDataSource.deleteOne(sample)
        return result;
    }

    async deleteSampleFromStorage(sample_name: string, project_id: number): Promise<number> {
        const folderPath = path.join(this.DATA_STORAGE_FS_STORAGE, `${project_id}`, `${sample_name}`);
        try {
            console.log(`Deleting sample from storage: ${folderPath}`);
            await fs.rm(folderPath, { recursive: true, force: true });
            return 1;
        } catch (error) {
            throw new Error(`Error deleting sample from storage: ${error.message}`);
        }
    }

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
    //     const params_restricted = ["sample_id", "root_folder_path", "sample_title", "sample_acronym", "sample_description", "sample_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number"]
    //     const updated_sample_nb = await this.updateSample(sample, params_restricted)
    //     return updated_sample_nb
    // }

    async standardGetSamples(options: PreparedSearchOptions): Promise<SearchResult<PublicSampleModel>> {
        // Can be filtered by 
        const filter_params_restricted = ["sample_id", "sample_name", "comment", "instrument_serial_number", "optional_structure_id", "max_pressure", "integration_time", "station_id", "sampling_date", "latitude", "longitude", "wind_direction", "wind_speed", "sea_state", "nebulousness", "bottom_depth", "operator_email", "filename", "filter_first_image", "filter_last_image", "instrument_settings_acq_gain", "instrument_settings_acq_description", "instrument_settings_acq_task_type", "instrument_settings_acq_choice", "instrument_settings_acq_disk_type", "instrument_settings_acq_appendices_ratio", "instrument_settings_acq_xsize", "instrument_settings_acq_ysize", "instrument_settings_acq_erase_border", "instrument_settings_acq_threshold", "instrument_settings_process_datetime", "instrument_settings_process_gamma", "instrument_settings_images_post_process", "instrument_settings_aa", "instrument_settings_exp", "instrument_settings_image_volume_l", "instrument_settings_pixel_size_mm", "instrument_settings_depth_offset_m", "instrument_settings_particle_minimum_size_pixels", "instrument_settings_vignettes_minimum_size_pixels", "instrument_settings_particle_minimum_size_esd", "instrument_settings_vignettes_minimum_size_esd", "instrument_settings_acq_shutter", "instrument_settings_acq_shutter_speed", "instrument_settings_acq_exposure", "visual_qc_validator_user_id", "sample_type_id", "project_id", "visual_qc_status_id"]

        // Can be sort_by 
        const sort_param_restricted = ["sample_id", "sample_name", "comment", "instrument_serial_number", "optional_structure_id", "max_pressure", "integration_time", "station_id", "sampling_date", "latitude", "longitude", "wind_direction", "wind_speed", "sea_state", "nebulousness", "bottom_depth", "operator_email", "filename", "filter_first_image", "filter_last_image", "instrument_settings_acq_gain", "instrument_settings_acq_description", "instrument_settings_acq_task_type", "instrument_settings_acq_choice", "instrument_settings_acq_disk_type", "instrument_settings_acq_appendices_ratio", "instrument_settings_acq_xsize", "instrument_settings_acq_ysize", "instrument_settings_acq_erase_border", "instrument_settings_acq_threshold", "instrument_settings_process_datetime", "instrument_settings_process_gamma", "instrument_settings_images_post_process", "instrument_settings_aa", "instrument_settings_exp", "instrument_settings_image_volume_l", "instrument_settings_pixel_size_mm", "instrument_settings_depth_offset_m", "instrument_settings_particle_minimum_size_pixels", "instrument_settings_vignettes_minimum_size_pixels", "instrument_settings_particle_minimum_size_esd", "instrument_settings_vignettes_minimum_size_esd", "instrument_settings_acq_shutter", "instrument_settings_acq_shutter_speed", "instrument_settings_acq_exposure", "visual_qc_validator_user_id", "sample_type_id", "project_id", "visual_qc_status_id"]

        return await this.getSamples(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    private async getSamples(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<PublicSampleModel>> {
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

        return await this.sampleDataSource.getAll(options);
    }

    // getSampleType
    async getSampleType(sample_type: SampleTypeRequestModel): Promise<SampleTypeModel | null> {

        // Clean the sample type to keep only sample_type_id, sample_type_label, sample_type_description if they are defined
        const cleaned_sample_type: SampleTypeRequestModel = {};

        if (sample_type.sample_type_id !== undefined) cleaned_sample_type.sample_type_id = sample_type.sample_type_id;
        if (sample_type.sample_type_label !== undefined) cleaned_sample_type.sample_type_label = sample_type.sample_type_label;
        if (sample_type.sample_type_description !== undefined) cleaned_sample_type.sample_type_description = sample_type.sample_type_description;

        // Get the result from the data source
        const result = await this.sampleDataSource.getSampleType(cleaned_sample_type);

        return result;
    }
    // getVisualQCStatus
    async getVisualQCStatus(visual_qc_status: VisualQualityCheckStatusRequestModel): Promise<VisualQualityCheckStatusModel | null> {
        // Clean the visual qc status to keep only visual_qc_status_id, visual_qc_status_label,  if they are defined
        const cleaned_visual_qc_status: VisualQualityCheckStatusRequestModel = {};

        if (visual_qc_status.visual_qc_status_id !== undefined) cleaned_visual_qc_status.visual_qc_status_id = visual_qc_status.visual_qc_status_id;
        if (visual_qc_status.visual_qc_status_label !== undefined) cleaned_visual_qc_status.visual_qc_status_label = visual_qc_status.visual_qc_status_label;

        // Get the result from the data source
        const result = await this.sampleDataSource.getVisualQCStatus(cleaned_visual_qc_status);
        return result;
    }

}