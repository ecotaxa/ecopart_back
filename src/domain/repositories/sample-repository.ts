
import { SampleDataSource } from "../../data/interfaces/data-sources/sample-data-source";
// import { InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PublicPrivilege } from "../entities/privilege";
// import { SampleRequestCreationModel, SampleRequestModel, SampleUpdateModel, SampleResponseModel, PublicHeaderSampleResponseModel, PublicSampleRequestCreationModel } from "../entities/sample";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
// import { SampleRepository } from "../interfaces/repositories/sample-repository";

import { ComputeVignettesModel, HeaderSampleModel, MetadataIniSampleModel, MinimalSampleRequestModel, PublicHeaderSampleResponseModel, PublicSampleModel, SampleFromConfigurationDataModel, SampleFromCruiseInfoModel, SampleFromInstallConfigModel, SampleFromMetaHeaderModel, SampleFromWorkDatfileModel, SampleFromWorkHDRModel, SampleIdModel, SampleRequestCreationModel, SampleRequestModel, SampleTypeModel, SampleTypeRequestModel, VisualQualityCheckStatusModel, VisualQualityCheckStatusRequestModel } from "../entities/sample";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { SampleRepository } from "../interfaces/repositories/sample-repository";


import * as fs from 'fs'; // For createWriteStream
import * as fsPromises from 'fs/promises'; // For promise-based file operations//import fs from 'fs'; // Correct import for `createReadStream`
//import { parse, Options } from 'csv-parse'; // Use named import for `parse`

import path from 'path';
import yauzl from 'yauzl';
import archiver from 'archiver';




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
    // Generic method to read a file from a ZIP archive
    private async readFileFromZip(zipPath: string, targetFileName?: string, filePathPattern?: RegExp): Promise<string> {
        return new Promise((resolve, reject) => {
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) {
                    return reject(err || new Error('Failed to open zip file'));
                }

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if ((targetFileName && entry.fileName === targetFileName) || (filePathPattern && filePathPattern.test(entry.fileName))) {
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err || !readStream) {
                                return reject(err || new Error('Failed to open read stream'));
                            }

                            let data = '';
                            readStream.on('data', (chunk) => (data += chunk));
                            readStream.on('end', () => resolve(data));
                        });
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('end', () => reject(new Error(`${targetFileName} or ${filePathPattern} not found in zip file`)));
            });
        });
    }
    // Method to parse and return ComputeVignettes data
    async readComputeVignettes(file_system_storage_project_folder: string, sample_name: string): Promise<ComputeVignettesModel> {
        const zipPath = path.join(file_system_storage_project_folder, sample_name, `${sample_name}_Images.zip`);
        const fileContent = await this.readFileFromZip(zipPath, 'compute_vignette.txt', undefined);
        return this.parseComputeVignettes(fileContent);
    }

    // Method to parse and return pressures from particules.csv
    async getPressuresFromParticulesCsv(file_system_storage_project_folder: string, sample_name: string): Promise<(number | "NaN")[]> {
        const zipPath = path.join(file_system_storage_project_folder, sample_name, `${sample_name}_Particule.zip`);
        const fileContent = await this.readFileFromZip(zipPath, 'particules.csv', undefined);
        return this.extractPressures(fileContent);
    }

    async getSampleFromFsStorage(file_system_storage_project_folder: string, base_sample: Partial<SampleRequestCreationModel>, instrument_model: string): Promise<SampleRequestCreationModel> {
        let sample_fss = {};

        if (instrument_model.startsWith('UVP6')) {
            // read from file_system_storage_project_folder/ecodata and return the list of samples
            sample_fss = await this.getSampleFromFsStorageUVP6(file_system_storage_project_folder, base_sample.sample_name as string);
        }
        else if (instrument_model.startsWith('UVP5')) {
            // read from file_system_storage_project_folder/work and return the list of samples
            sample_fss = await this.getSampleFromFsStorageUVP5(file_system_storage_project_folder, base_sample.sample_name as string);
        }
        const sample = this.constructSampleFromBaseAndFsStorage(sample_fss, base_sample);

        return sample;
    }

    async getSampleFromFsStorageUVP5(file_system_storage_project_folder: string, sample_name: string): Promise<Partial<SampleRequestCreationModel>> {
        // Complete the sample object
        // Get sample info from meta/uvp5_header_sn
        const sample_header = await this.getSampleFromMetaHeader(file_system_storage_project_folder, sample_name);
        // get sample from work/profileid/profileid_datfile.txt
        const sample_work_datfile = await this.getSampleFromWorkDatfile(file_system_storage_project_folder, sample_name);
        // get sample from work/profileid/HDRfilename.txt 
        const sample_work_hdr = await this.getSampleFromWorkHDR(file_system_storage_project_folder, sample_name);
        // get sample from config/cruise_info.txt 
        const sample_cruise_info = await this.getSampleFromCruiseInfo(file_system_storage_project_folder, sample_name);
        // get sample from config/uvp5_settings/uvp5_configuration_data.txt
        const sample_configurationdata = await this.getSampleFromConfigurationData(file_system_storage_project_folder, sample_name);
        // get sample from config/process_install_config.txt
        const sample_install_config = await this.getSampleFromInstallConfig(file_system_storage_project_folder, sample_name);

        //TODO hardcode "zooprocess"
        const instrument_settings_images_post_process = "zooprocess";

        // Process some fields
        // Process sample_type_id
        const sample_type_id = await this.computeSampleTypeId(sample_header.sampleType);
        // Process latitude and longitude
        const coords = this.computeLatitudeAndLongitude(sample_header.latitude_raw, sample_header.longitude_raw);

        // Construct the sample object
        delete (sample_header as any).sampleType;
        delete (sample_header as any).latitude_raw;
        delete (sample_header as any).longitude_raw;

        // Construct the sample object
        const sample_to_return: Partial<SampleRequestCreationModel> = {
            ...sample_header,
            ...sample_work_datfile,
            ...sample_work_hdr,
            ...sample_cruise_info,
            ...sample_configurationdata,
            ...sample_install_config,
            sample_type_id,
            instrument_settings_images_post_process,
            latitude: coords.latitude,
            longitude: coords.longitude
        };
        return sample_to_return;
    }

    async getSampleFromInstallConfig(file_system_storage_project_folder: string, sample_name: string): Promise<SampleFromInstallConfigModel> {
        const filePath = 'config/process_install_config.txt';
        const zipPath = path.join(file_system_storage_project_folder, `${sample_name}.zip`);
        const fileContent = await this.readFileFromZip(zipPath, filePath, undefined);
        return this.parseInstallConfig(fileContent);
    }
    async getSampleFromConfigurationData(file_system_storage_project_folder: string, sample_name: string): Promise<SampleFromConfigurationDataModel> {
        const filePath = 'config/uvp5_settings/uvp5_configuration_data.txt';
        const zipPath = path.join(file_system_storage_project_folder, `${sample_name}.zip`);
        const fileContent = await this.readFileFromZip(zipPath, filePath, undefined);
        return this.parseConfigurationData(fileContent);
    }
    async getSampleFromCruiseInfo(file_system_storage_project_folder: string, sample_name: string): Promise<SampleFromCruiseInfoModel> {
        const filePath = 'config/cruise_info.txt';
        const zipPath = path.join(file_system_storage_project_folder, `${sample_name}.zip`);
        const fileContent = await this.readFileFromZip(zipPath, filePath, undefined);
        return this.parseCruiseInfo(fileContent);
    }
    async getSampleFromWorkHDR(file_system_storage_project_folder: string, sample_name: string): Promise<SampleFromWorkHDRModel> {
        // Construct the file path to match files starting with "HDR" and ending with ".txt"
        const filePathPattern = new RegExp(`^work/${sample_name}/HDR.*\\.txt$`);
        const zipPath = path.join(file_system_storage_project_folder, `${sample_name}.zip`);
        const fileContent = await this.readFileFromZip(zipPath, undefined, filePathPattern);
        return this.parseWorkHDR(fileContent);
    }
    async getSampleFromWorkDatfile(file_system_storage_project_folder: string, sample_name: string): Promise<SampleFromWorkDatfileModel> {
        const filePath = 'work/' + sample_name + '/' + sample_name + '_datfile.txt'; // perle3_003_datfile.txt
        const zipPath = path.join(file_system_storage_project_folder, `${sample_name}.zip`);
        const fileContent = await this.readFileFromZip(zipPath, filePath, undefined);
        return this.parseWorkDatfile(fileContent);
    }
    async getSampleFromMetaHeader(file_system_storage_project_folder: string, sample_name: string): Promise<SampleFromMetaHeaderModel> {
        const filePathPattern = new RegExp(`^meta/uvp5_header_sn.*\\.txt$`);//uvp5_header_sn205_perle_03_2020.txt
        const zipPath = path.join(file_system_storage_project_folder, `${sample_name}.zip`);
        const fileContent = await this.readFileFromZip(zipPath, undefined, filePathPattern);
        const fileName = await this.getFileNameFromZip(zipPath, filePathPattern);

        return this.parseMetaHeader(fileContent, fileName);
    }

    async getFileNameFromZip(zipPath: string, filePathPattern: RegExp): Promise<string> {
        return new Promise((resolve, reject) => {
            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) {
                    return reject(err || new Error('Failed to open zip file'));
                }

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (filePathPattern.test(entry.fileName)) {
                        resolve(entry.fileName);
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('end', () => reject(new Error('File not found in zip')));
            });
        });
    }

    async getSampleFromFsStorageUVP6(file_system_storage_project_folder: string, sample_name: string): Promise<Partial<SampleRequestCreationModel>> {

        /***
         *  
            fetch data from metadata.ini:
                *****
            process already fetch data:
                latitude: this.computeLatitude(ini_content.sample_metadata['latitude'] as number),
                longitude: this.computeLongitude(ini_content.sample_metadata['longitude'] as number),
 
                sample_type_id: this.getSampleTypeFromLetter(ini_content.sample_metadata['sampletype']), 
 
            go to another file to get the data:  
                max_pressure: this.computeMaxPressure(),
                instrument_settings_process_gamma: this.getGammaForUVP6(), 
 
         * 
         ***/
        // Complete/reprocess the sample object
        // Get sample info from metadata.ini
        const sample_metadata_ini = await this.getSampleFromMetadataIni(file_system_storage_project_folder, sample_name);
        // Process sample_type_id
        const sample_type_id = await this.computeSampleTypeId(sample_metadata_ini.sampleType);
        // Process latitude and longitude
        const coords = this.computeLatitudeAndLongitude(sample_metadata_ini.latitude_raw, sample_metadata_ini.longitude_raw);

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


    async computeMaxPressure(sample: MetadataIniSampleModel, file_system_storage_project_folder: string, sample_name: string): Promise<number | undefined> {
        // Read the pressure file
        const pressures = await this.getPressuresFromParticulesCsv(file_system_storage_project_folder, sample_name);
        // Compute the max pressure
        const max_pressure = this.getMaxPressure(pressures);

        return max_pressure;
    }

    getMaxPressure(pressures: (number | "NaN")[]): number | undefined {
        // Filter out "NaN" values and ensure only numbers are considered
        const numericPressures = pressures.filter((value): value is number => value !== "NaN");

        // If the array is empty, return undefined to indicate no valid pressures
        if (numericPressures.length === 0) {
            return undefined;
        }

        // Use Math.max to find the maximum pressure
        return Math.max(...numericPressures);
    }

    extractPressures(input: string): (number | "NaN")[] {
        // Split the input by lines
        const lines = input.split("\n");
        const pressures: (number | "NaN")[] = [];

        lines.forEach((line) => {
            // Match lines that start with a timestamp and have a pressure value
            const match = line.match(/^\d{8}-\d{6},([0-9.]+|NaN),/);
            if (match) {
                const pressure = match[1];
                // Convert to number or retain "NaN" as string
                pressures.push(pressure === "NaN" ? "NaN" : parseFloat(pressure));
            }
        });

        return pressures;
    }


    computeLatitudeAndLongitude(latitude_raw: string | undefined, longitude_raw: string | undefined): { latitude: number, longitude: number } {
        if (latitude_raw === undefined || longitude_raw === undefined) {
            throw new Error("Latitude or longitude not found");
        }  // #TODO what to do if not found????

        // Compute latitude and longitude
        const latitude = this.convTextDegreeDotMinuteToDecimalDegree(latitude_raw, 'uvp6');
        const longitude = this.convTextDegreeDotMinuteToDecimalDegree(longitude_raw, 'uvp6');

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
                const floatValue = parseFloat(v);
                const integerPart = Math.floor(floatValue);
                const fractionPart = floatValue - integerPart;
                return parseFloat((integerPart + fractionPart / 0.6).toFixed(5));
            } else {
                return parseFloat(parseFloat(v).toFixed(5));
            }
        }
    }

    async computeSampleTypeId(sampleType: string | undefined): Promise<number> {
        // Défini par la personne qui crée le sample dans UVPapp (UVP6 : T for Time D for depth, UVP5 : N for depth, Y for depth:yoyo, H for autre ou time)
        let sample_type_id: number | undefined;

        // Throw error if unknown sample type
        if (sampleType === undefined) throw new Error("Undefined sample type");

        // Compute sample_type_id
        if (sampleType == "T" || sampleType == "H") {
            sample_type_id = (await this.getSampleType({ sample_type_label: "Time" }))?.sample_type_id;
        } else if (sampleType == "D" || sampleType == "N" || sampleType == "Y") {
            sample_type_id = (await this.getSampleType({ sample_type_label: "Depth" }))?.sample_type_id;
        } else throw new Error("Unknown sample type : " + sampleType);

        if (sample_type_id === undefined) throw new Error("Sample type not found");
        return sample_type_id
    }

    // Method to read and parse the metadata.ini file
    async getSampleFromMetadataIni(file_system_storage_project_folder: string, sample_name: string): Promise<MetadataIniSampleModel> {
        const zipPath = path.join(file_system_storage_project_folder, sample_name, `${sample_name}_Particule.zip`);
        const fileContent = await this.readFileFromZip(zipPath, 'metadata.ini', undefined);
        return this.parseIniContent(fileContent);
    }

    parseInstallConfig(data: string): SampleFromInstallConfigModel {
        const install_config_content: any = {};
        // Split the data by new lines and process each line
        const lines = data.split('\n');
        lines.forEach(line => {
            // Split each line by the equal sign and trim whitespace
            const [key, value] = line.split('=').map(str => str.trim());
            if (key && value) {
                install_config_content[key] = value;
            }
        });

        // Prepare the output object
        const sample: SampleFromInstallConfigModel = {
            instrument_settings_process_gamma: install_config_content['gamma'],
            instrument_settings_vignettes_minimum_size_esd: install_config_content['esdmin']
        };
        return sample;
    }


    parseConfigurationData(data: string): SampleFromConfigurationDataModel {
        const configuration_data_content: any = {};

        // Split the data into lines and process each line
        const lines = data.split('\n');

        lines.forEach(line => {
            // Skip lines that don't contain key-value pairs (like headers or empty lines)
            if (line.includes('=')) {
                const [key, value] = line.split('=').map(item => item.trim());
                configuration_data_content[key] = value;
            }
        });

        // Create the model with the parsed data
        const sample: SampleFromConfigurationDataModel = {
            instrument_settings_acq_xsize: configuration_data_content['xsize'],           // xsize
            instrument_settings_acq_ysize: configuration_data_content['ysize'],           // ysize
            instrument_settings_pixel_size_mm: configuration_data_content['pixel']        // Pixel_Size
        };

        return sample;
    }

    parseCruiseInfo(data: string): SampleFromCruiseInfoModel {
        const cruise_info_content: any = {};
        // Parse the input data string into a key-value object
        const lines = data.split("\n");
        lines.forEach(line => {
            const [key, value] = line.split("=");
            if (key && value) {
                cruise_info_content[key.trim()] = value.trim();
            }
        });

        // Construct the SampleFromCruiseInfoModel object
        const sample: SampleFromCruiseInfoModel = {
            instrument_operator_email: cruise_info_content["op_email"],     // 'op_email'
            // Add other properties as needed based on the SampleFromCruiseInfoModel structure
        };
        return sample;
    }

    parseWorkHDR(data: string): SampleFromWorkHDRModel {
        const work_hdr_content: any = {};
        // Parse the input data string into a key-value object
        const lines = data.split("\n");
        lines.forEach(line => {
            const [key, value] = line.split("=");
            if (key && value) {
                work_hdr_content[key.trim()] = value.trim();
            }
        });
        // Create the sample object
        const sample: SampleFromWorkHDRModel = {
            instrument_settings_acq_gain: parseInt(work_hdr_content['Gain']),                                 // Gain
            instrument_settings_acq_description: lines[1].replace(';', '').trim(),                            // 2nd line description
            instrument_settings_acq_task_type: parseInt(work_hdr_content['TaskType']),                        // TaskType
            instrument_settings_acq_choice: parseInt(work_hdr_content['Choice']),                             // Choice
            instrument_settings_acq_disk_type: parseInt(work_hdr_content['DiskType']),                        // DiskType
            instrument_settings_acq_appendices_ratio: parseInt(work_hdr_content['Ratio']),                    // Ratio
            instrument_settings_acq_erase_border: parseInt(work_hdr_content['EraseBorderBlobs']),             // EraseBorderBlobs
            instrument_settings_acq_threshold: parseInt(work_hdr_content['Thresh']),                          // Thresh
            instrument_settings_particle_minimum_size_pixels: parseInt(work_hdr_content['SMbase']),           // SMbase
            instrument_settings_vignettes_minimum_size_pixels: parseInt(work_hdr_content['SMzoo']),           // SMzoo
            instrument_settings_acq_shutter_speed: parseInt(work_hdr_content['Exposure']) || undefined,       // Exposure UVP5HD
            instrument_settings_acq_exposure: parseInt(work_hdr_content['ShutterSpeed']) || undefined         // ShutterSpeed UVP5SD (default to 0 if missing)
        };
        return sample;
    }


    parseWorkDatfile(data: string): SampleFromWorkDatfileModel {
        const work_datfile_content: any = {};

        // Split the data into lines and process each line
        const lines = data.trim().split("\n");
        const pressures: number[] = [];

        lines.forEach((line) => {
            const columns = line.split(";").map((col) => col.trim());
            // Assuming the pressure value is the 3 column (index 2 in zero-based indexing)//TODO check with marc
            const pressure = parseInt(columns[2], 10);
            if (!isNaN(pressure)) {
                pressures.push(pressure);
            }
        });

        // Find the maximum pressure value
        const maxPressure = Math.max(...pressures);

        // Assign to work_datfile_content
        work_datfile_content.sample_metadata = {
            max_pressure: maxPressure,
        };

        const sample: SampleFromWorkDatfileModel = {
            max_pressure: work_datfile_content.sample_metadata.max_pressure,
        };
        return sample;
    }



    parseMetaHeader(data: string, fileName: string): SampleFromMetaHeaderModel {
        // Compute instrument serial number from the file name
        const instrumentSerialMatch = fileName.match(/sn(\d+)/i); // Example: matches "sn205" in "uvp5_header_sn205_perle_03_2020.txt"
        if (!instrumentSerialMatch) throw new Error('Instrument serial number not found');
        const instrumentSerialNumber = instrumentSerialMatch[1]

        // Prepare the object to store the parsed data
        const meta_header_content: any = {};

        // Split the input data by lines
        const lines = data.split('\n').filter(line => line.trim() !== '');

        // Extract the headers (first line)
        const headers = lines[0].split(';');

        // Parse the remaining lines into objects
        const rows = lines.slice(1).map(line => {
            const values = line.split(';');
            const rowObject: any = {};
            headers.forEach((header, index) => {
                rowObject[header.trim()] = values[index] ? values[index].trim() : null;
            });
            return rowObject;
        });

        // Assign the first row (or any specific row) to `meta_header_content`
        meta_header_content.sample_metadata = rows[0]; // Assuming we want the first row's data

        const sample: SampleFromMetaHeaderModel = {
            sample_name: meta_header_content.sample_metadata['profileid'],
            comment: meta_header_content.sample_metadata['comment'],
            instrument_serial_number: instrumentSerialNumber,//TODO : is the sn205 in uvp5_header_sn205_perle_03_2020.txt
            station_id: meta_header_content.sample_metadata['stationid'],
            sampling_date: meta_header_content.sample_metadata['filename'],
            latitude_raw: meta_header_content.sample_metadata['latitude'],
            longitude_raw: meta_header_content.sample_metadata['longitude'],
            wind_direction: meta_header_content.sample_metadata['winddir'],
            wind_speed: parseFloat(meta_header_content.sample_metadata['windspeed']),
            sea_state: meta_header_content.sample_metadata['seastate'],
            nebulousness: parseFloat(meta_header_content.sample_metadata['nebuloussness']),
            bottom_depth: parseFloat(meta_header_content.sample_metadata['bottomdepth']),
            filename: meta_header_content.sample_metadata['filename'],
            filter_first_image: meta_header_content.sample_metadata['firstimage'],
            filter_last_image: meta_header_content.sample_metadata['endimg'],
            sampleType: meta_header_content.sample_metadata['yoyo'],
            instrument_settings_aa: parseFloat(meta_header_content.sample_metadata['aa']),
            instrument_settings_exp: parseFloat(meta_header_content.sample_metadata['exp']),
            instrument_settings_image_volume_l: parseFloat(meta_header_content.sample_metadata['volimage']),
        };
        return sample;
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
            instrument_settings_acq_gain: ini_content.HW_CONF['Gain'] as number,
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
            await fsPromises.access(folderPath);
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
            const files = await fsPromises.readdir(folderPath);

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
            const files = await fsPromises.readdir(header_path);
            for (const file of files) {
                if (file.includes('header') && file.endsWith('.txt')) {
                    const filePath = path.join(header_path, file);
                    const content = await fsPromises.readFile(filePath, 'utf8');

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
            const files = await fsPromises.readdir(path.join(folderPath, 'ecodata'));

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
            const files = await fsPromises.readdir(path.join(folderPath, 'work'));

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
                await fsPromises.access(destPath);
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
    async UVP5copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void> {
        const base_folder = path.join(__dirname, '..', '..', '..');

        // Ensure that none of the samples folder already exists
        await this.ensureSampleFolderDoNotExists(samples_names_to_import, path.join(base_folder, dest_folder));

        // Create destination folder
        await fsPromises.mkdir(path.join(base_folder, dest_folder), { recursive: true });

        // Iterate over each sample name, create the sample folder, copy files, and zip the folder
        for (const sample of samples_names_to_import) {
            const sourcePath = path.join(base_folder, source_folder);
            const destPath = path.join(base_folder, dest_folder, sample);

            // Ensure the destination sample folder exists
            await fsPromises.mkdir(destPath, { recursive: true });

            // Copy specific files and directories
            const filesToCopy = [
                { source: 'work/' + sample, dest: 'work/' + sample },
                { source: 'meta', dest: 'meta' },
                { source: 'config/cruise_info.txt', dest: 'config/cruise_info.txt' },
                { source: 'config/uvp5_settings/uvp5_configuration_data.txt', dest: 'config/uvp5_settings/uvp5_configuration_data.txt' },
                { source: 'config/process_install_config.txt', dest: 'config/process_install_config.txt' },
            ];

            for (const file of filesToCopy) {
                const sourceFilePath = path.join(sourcePath, file.source);
                const destFilePath = path.join(destPath, file.dest);

                try {
                    // Ensure the parent folder exists for nested files
                    await fsPromises.mkdir(path.dirname(destFilePath), { recursive: true });

                    // Copy the file or directory
                    await fsPromises.cp(sourceFilePath, destFilePath, { recursive: true });
                } catch (error) {
                    throw new Error(`Error copying ${file.source} for sample ${sample}: ${error.message}`);
                }
            }

            // Zip the sample folder
            const zipFilePath = path.join(base_folder, dest_folder, `${sample}.zip`);
            try {
                await this.zipFolder(destPath, zipFilePath);

                // Remove the unzipped folder after zipping
                await fsPromises.rm(destPath, { recursive: true, force: true });
            } catch (error) {
                throw new Error(`Error zipping folder for sample ${sample}: ${error.message}`);
            }
        }
    }

    async zipFolder(folderPath: string, zipFilePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } }); // High compression level

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(folderPath, false); // Add folder contents
            archive.finalize();
        });
    }

    async UVP6copySamplesToImportFolder(source_folder: string, dest_folder: string, samples_names_to_import: string[]): Promise<void> {

        const base_folder = path.join(__dirname, '..', '..', '..');
        // Ensure that non of the samples folder already exists
        await this.ensureSampleFolderDoNotExists(samples_names_to_import, path.join(base_folder, dest_folder));

        // Ensure destination folder exists
        await fsPromises.mkdir(path.join(base_folder, dest_folder), { recursive: true });

        // Iterate over each sample name and copy .zip files only
        for (const sample of samples_names_to_import) {
            const sourcePath = path.join(base_folder, source_folder, sample);
            const destPath = path.join(base_folder, dest_folder, sample);

            // Check if the sample directory exists and list files
            const files = await fsPromises.readdir(sourcePath);

            // Filter and copy only .zip files
            for (const file of files) {
                if (path.extname(file) === '.zip') {
                    const sourceFilePath = path.join(sourcePath, file);
                    const destFilePath = path.join(destPath, file);

                    // Ensure destination subfolder exists
                    await fsPromises.mkdir(destPath, { recursive: true });
                    await fsPromises.copyFile(sourceFilePath, destFilePath);
                }
            }
        }
    }

    async deleteSamplesFromImportFolder(dest_folder: string, samples_names_to_import: string[]): Promise<void> {
        const base_folder = path.join(__dirname, '..', '..', '..');

        for (const sample of samples_names_to_import) {
            // Construct paths for the .zip file and the folder
            const zipPath = path.join(base_folder, dest_folder, `${sample}.zip`);
            const folderPath = path.join(base_folder, dest_folder, sample);

            // Delete the .zip file
            await fsPromises.rm(zipPath, { force: true });

            // Delete the folder and its contents recursively
            await fsPromises.rm(folderPath, { recursive: true, force: true });
        }
    }

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
            await fsPromises.rm(folderPath, { recursive: true, force: true });
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
        const filter_params_restricted = ["sample_id", "sample_name", "comment", "instrument_serial_number", "optional_structure_id", "max_pressure", "station_id", "sampling_date", "latitude", "longitude", "wind_direction", "wind_speed", "sea_state", "nebulousness", "bottom_depth", "operator_email", "filename", "filter_first_image", "filter_last_image", "instrument_settings_acq_gain", "instrument_settings_acq_description", "instrument_settings_acq_task_type", "instrument_settings_acq_choice", "instrument_settings_acq_disk_type", "instrument_settings_acq_appendices_ratio", "instrument_settings_acq_xsize", "instrument_settings_acq_ysize", "instrument_settings_acq_erase_border", "instrument_settings_acq_threshold", "instrument_settings_process_datetime", "instrument_settings_process_gamma", "instrument_settings_images_post_process", "instrument_settings_aa", "instrument_settings_exp", "instrument_settings_image_volume_l", "instrument_settings_pixel_size_mm", "instrument_settings_depth_offset_m", "instrument_settings_particle_minimum_size_pixels", "instrument_settings_vignettes_minimum_size_pixels", "instrument_settings_particle_minimum_size_esd", "instrument_settings_vignettes_minimum_size_esd", "instrument_settings_acq_shutter", "instrument_settings_acq_shutter_speed", "instrument_settings_acq_exposure", "visual_qc_validator_user_id", "sample_type_id", "project_id", "visual_qc_status_id"]

        // Can be sort_by 
        const sort_param_restricted = ["sample_id", "sample_name", "comment", "instrument_serial_number", "optional_structure_id", "max_pressure", "station_id", "sampling_date", "latitude", "longitude", "wind_direction", "wind_speed", "sea_state", "nebulousness", "bottom_depth", "operator_email", "filename", "filter_first_image", "filter_last_image", "instrument_settings_acq_gain", "instrument_settings_acq_description", "instrument_settings_acq_task_type", "instrument_settings_acq_choice", "instrument_settings_acq_disk_type", "instrument_settings_acq_appendices_ratio", "instrument_settings_acq_xsize", "instrument_settings_acq_ysize", "instrument_settings_acq_erase_border", "instrument_settings_acq_threshold", "instrument_settings_process_datetime", "instrument_settings_process_gamma", "instrument_settings_images_post_process", "instrument_settings_aa", "instrument_settings_exp", "instrument_settings_image_volume_l", "instrument_settings_pixel_size_mm", "instrument_settings_depth_offset_m", "instrument_settings_particle_minimum_size_pixels", "instrument_settings_vignettes_minimum_size_pixels", "instrument_settings_particle_minimum_size_esd", "instrument_settings_vignettes_minimum_size_esd", "instrument_settings_acq_shutter", "instrument_settings_acq_shutter_speed", "instrument_settings_acq_exposure", "visual_qc_validator_user_id", "sample_type_id", "project_id", "visual_qc_status_id"]

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