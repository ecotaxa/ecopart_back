/* SAMPLE */

export interface SampleRequestCreationModel {
    sample_name: string;                       // Sample name
    comment: string;                           // Optional comment
    instrument_serial_number: string;          // Instrument serial number
    max_pressure: number;                      // Maximum pressure (in relevant unit)
    station_id: string;                        // Station identifier
    sampling_utc_date_time: string;                     // Sampling date in ISO format
    latitude: number;                          // Latitude (in decimal degrees) [DD.DDDD] (- for South)
    longitude: number;                         // Longitude (in decimal degrees) [DDD.DDDD] (- for West)
    wind_direction: number;                    // Wind direction (in degrees)
    wind_speed: number;                        // Wind speed (in relevant unit)
    sea_state: string;                         // Description or classification of sea state
    nebulousness: number;                      // Cloud coverage percentage (0-100)
    bottom_depth: number;                      // Bottom depth (in meters or relevant unit)
    instrument_operator_email: string;         // Operator's email
    filename: string;                          // source file name

    filter_first_image: string;                // First image
    filter_last_image: string;                 // Last image

    instrument_settings_acq_gain: number;                        // Gain applied to the imager at acquisition
    instrument_settings_acq_description: string | undefined;                 // Free-text descriptor of the acquisition (e.g. "uvp5hd sn200 : mixtfd")
    instrument_settings_acq_task_type: number | undefined;                   // UVP5 task type enum: -1 error, 0 save only, 1 process only, 2 mixt process, 3 full process
    instrument_settings_acq_choice: number | undefined;                     // Acquisition choice
    instrument_settings_acq_disk_type: number | undefined;                   // Acquisition disk type
    instrument_settings_acq_vignette_roi_enlargement_ratio: number;          // Ratio used to crop a wider area than the ROI around each vignette (renamed from acq_appendices_ratio)
    instrument_settings_acq_x_size: number | undefined;                       // Acquisition X size (in pixels)
    instrument_settings_acq_y_size: number | undefined;                       // Acquisition Y size (in pixels)
    instrument_settings_acq_erase_border: number | undefined;                // Acquisition erase border (0/1 boolean)
    instrument_settings_acq_threshold: number;                   // Acquisition threshold value
    instrument_settings_acq_pressure_gain?: number;              // Pressure gain to convert raw pressure to decibar in LPM data. UVP6 = 1; UVP5 = TODO (Marc confirms 0.1 or 10)
    instrument_settings_process_datetime: string | undefined;                // Zooprocess processing datetime (UVP5sd/UVP5hd) — not currently populated at import
    instrument_settings_process_gamma: number | undefined                  // Process gamma value
    instrument_settings_process_vignette_resize_factor?: number; // Scale factor used to resize vignettes when saving them. UVP5SD=2, UVP5HD=1, UVP6=compute_vignettes.txt scale
    instrument_settings_images_post_process: string;             // Post-process software (Zooprocess for UVP5)
    instrument_settings_aa: number;                              // Aa coefficient (UVP6: divided by 10^6)
    instrument_settings_exp: number;                             // Exp coefficient
    instrument_settings_image_volume_l: number;                  // Image volume in liters
    instrument_settings_pixel_size_mm: number;                   // Pixel size in millimeters
    instrument_settings_depth_offset_m: number;                  // Depth offset in meters
    instrument_settings_particule_minimum_area_pixels: number | undefined;   // Particle minimum AREA in pixels² (renamed from particle_minimum_size_pixels)
    instrument_settings_vignette_minimum_area_pixels: number | undefined;    // Vignette minimum AREA in pixels² (renamed from vignettes_minimum_size_pixels)
    instrument_settings_acq_shutter_speed?: number | undefined;               // UVP5SD code (always 12 = 1/10000 s) per Marc — current code populates from HDR Exposure, see follow-up #8
    instrument_settings_acq_exposure?: number | undefined;                    // UVP5HD/UVP6 shutter in µs per Marc — current code populates from HDR ShutterSpeed, see follow-up #8
    instrument_settings_integration_time?: number;               // Integration time in seconds (UVP5 TIME-mode samples, from meta file)

    nb_vignettes: number;                                   // Number of vignettes at import time
    nb_black: number;                                       // Number of black (lights-off) images at import — noise reference

    visual_qc_validator_user_id: number;                    // Quality check validator user identifier
    sample_type_id: number;                                 // Sample type depth or time
    project_id: number;                                     // Project identifier
}

export interface PrivateSampleModel extends SampleRequestCreationModel {
    sample_id: number;                          // Sample internal identifier
    sample_creation_utc_date_time: string;               // Creation date in ISO format
    visual_qc_status_id: number;                // Quality check status
    visual_qc_comment: string | null;           // QC reviewer comment (null until reviewed)
    visual_qc_validation_utc_date_time: string | null; // When the sample was validated/rejected (null until reviewed = source of truth for "reviewed")
    ecotaxa_import_status_id: number; // EcoTaxa import status
    ecotaxa_sample_imported: boolean;        // EcoTaxa sample imported flag
    ecotaxa_sample_import_utc_date_time: string;      // EcoTaxa sample import date
    ecotaxa_sample_id: number;               // EcoTaxa sample identifier
    ecotaxa_sample_tsv_file_name: string;    // EcoTaxa TSV file name
    ecotaxa_sample_local_folder_tsv_path: string; // Local path to the TSV file to import
    ecotaxa_sample_nb_images: number;        // EcoTaxa number of images
    ecotaxa_sample_task_id: number; // EcoTaxa sample task identifier
    ctd_imported: boolean;                   // CTD file imported flag
    ctd_station_id: string | null;           // CTD station identifier (from sample station_id at import time)
    ctd_file_extension: string | null;       // CTD file extension (e.g. 'ctd')
    ctd_import_utc_date_time: string | null;          // CTD import date in ISO format
    ctd_original_file_name: string | null;   // File name as found in the project's CTD folder before copy
    ctd_imported_file_name: string | null;   // File name written under the per-sample storage folder
    ctd_importator_user_id: number | null;   // User who ran the CTD import
    ctd_latitude: number | null;             // Latitude derived from the CTD file (when different from sample.latitude)
    ctd_longitude: number | null;            // Longitude derived from the CTD file (when different from sample.longitude)

    nb_vignettes: number;                    // Number of vignettes at import time
    nb_black: number;                        // Number of black (lights-off) images at import — noise reference

}
export interface PublicSampleModel extends PrivateSampleModel {
    sample_type_label: string;                    // Sample type name
    visual_qc_status_label: string;               // Quality check status
    visual_qc_validator_user: string;             // Quality check validator user name same format as "last_name first_name (email)"}
    visual_qc_validator_email: string;            // Email of the visual-QC validator (joined from user)
    ecotaxa_import_status_label: string;          // EcoTaxa import status
    ctd_importator_name: string | null;           // Display name (first + last) of the CTD importer (joined from user)
    ctd_importator_email: string | null;          // Email of the CTD importer (joined from user)
}
export interface SampleUpdateModel {
    [key: string]: any;
    sample_id: number;                         // Sample internal identifier
    visual_qc_status_id?: number;              // Quality check status (PENDING/VALIDATED/REJECTED id)
    visual_qc_validator_user_id?: number;      // Who validated/rejected
    visual_qc_comment?: string | null;         // QC reviewer comment
    visual_qc_validation_utc_date_time?: string | null; // When validated/rejected (ISO)
    ecotaxa_import_status_id?: number | null; // EcoTaxa import status
    ecotaxa_sample_imported?: boolean;                           // EcoTaxa sample imported flag
    ecotaxa_sample_import_utc_date_time?: string | null;                  // EcoTaxa sample import date
    ecotaxa_sample_id?: number | null;                           // EcoTaxa sample identifier
    ecotaxa_sample_tsv_file_name?: string | null;                // EcoTaxa TSV file name
    ecotaxa_sample_local_folder_tsv_path?: string | null; // Local path to the TSV file to import
    ecotaxa_sample_nb_images?: number | null;                    // EcoTaxa number of images
    ecotaxa_sample_task_id?: number | null; // EcoTaxa sample task identifier
    ctd_imported?: boolean;                                      // CTD file imported flag
    ctd_station_id?: string | null;                             // CTD station identifier
    ctd_file_extension?: string | null;                         // CTD file extension
    ctd_import_utc_date_time?: string | null;                            // CTD import date in ISO format
    ctd_original_file_name?: string | null;                     // Source CTD file name (before copy)
    ctd_imported_file_name?: string | null;                     // Destination CTD file name (after copy)
    ctd_importator_user_id?: number | null;                     // User who ran the CTD import
    ctd_latitude?: number | null;                               // CTD-derived latitude
    ctd_longitude?: number | null;                              // CTD-derived longitude
    nb_black?: number;                                          // Number of black (lights-off) images at import
}

export interface SampleRequestModel {
    sample_id?: number;                         // Sample internal identifier
    sample_name?: string;                       // Sample name
    comment?: string;                           // Optional comment
    instrument_serial_number?: string;          // Instrument serial number
    max_pressure?: number;                      // Maximum pressure (in relevant unit)
    station_id?: string;                        // Station identifier
    sampling_utc_date_time?: string;                     // Sampling date in ISO format
    latitude?: number;                          // Latitude (in decimal degrees) [DD.DDDD] (- for South)
    longitude?: number;                         // Longitude (in decimal degrees) [DDD.DDDD] (- for West)
    wind_direction?: number;                    // Wind direction (in degrees)
    wind_speed?: number;                        // Wind speed (in relevant unit)
    sea_state?: string;                         // Description or classification of sea state
    nebulousness?: number;                      // Cloud coverage percentage (0-100)
    bottom_depth?: number;                      // Bottom depth (in meters or relevant unit)
    instrument_operator_email?: string;                    // Operator's email
    filename?: string;                          // source file name

    filter_first_image?: string;                // First image
    filter_last_image?: string;                 // Last image

    instrument_settings_acq_gain?: number;
    instrument_settings_acq_description?: string | undefined;
    instrument_settings_acq_task_type?: number | undefined;
    instrument_settings_acq_choice?: number | undefined;
    instrument_settings_acq_disk_type?: number | undefined;
    instrument_settings_acq_vignette_roi_enlargement_ratio?: number;
    instrument_settings_acq_x_size?: number | undefined;
    instrument_settings_acq_y_size?: number | undefined;
    instrument_settings_acq_erase_border?: number | undefined;
    instrument_settings_acq_threshold?: number;
    instrument_settings_acq_pressure_gain?: number;
    instrument_settings_process_datetime?: string | undefined;
    instrument_settings_process_gamma?: number;
    instrument_settings_process_vignette_resize_factor?: number;
    instrument_settings_images_post_process?: string;
    instrument_settings_aa?: number;
    instrument_settings_exp?: number;
    instrument_settings_image_volume_l?: number;
    instrument_settings_pixel_size_mm?: number;
    instrument_settings_depth_offset_m?: number;
    instrument_settings_particule_minimum_area_pixels?: number | undefined;
    instrument_settings_vignette_minimum_area_pixels?: number | undefined;
    instrument_settings_acq_shutter_speed?: number | undefined;
    instrument_settings_acq_exposure?: number | undefined;
    instrument_settings_integration_time?: number;

    visual_qc_validator_user_id?: number;                      // Quality check validator user identifier
    sample_type_id?: number;                                      // Sample type depth or time
    project_id?: number;                                          // Project identifier
    ecotaxa_import_status_id?: number; // EcoTaxa import status
    ecotaxa_sample_imported?: boolean;                           // EcoTaxa sample imported flag
    ecotaxa_sample_import_utc_date_time?: string;                         // EcoTaxa sample import date
    ecotaxa_sample_id?: number;                                  // EcoTaxa sample identifier
    ecotaxa_sample_tsv_file_name?: string;                       // EcoTaxa TSV file name
    ecotaxa_sample_local_folder_tsv_path?: string; // Local path to the TSV file to import
    ecotaxa_sample_nb_images?: number;                           // EcoTaxa number of images
    ecotaxa_sample_task_id?: number; // EcoTaxa sample task identifier
    ctd_imported?: boolean;                                      // CTD file imported flag
    ctd_station_id?: string | null;                             // CTD station identifier
    ctd_file_extension?: string | null;                         // CTD file extension
    ctd_import_utc_date_time?: string | null;                            // CTD import date in ISO format
}

export interface ImportableCTDSampleModel {
    sample_name: string;        // Matching EcoPart sample name
    file_extension: string;     // CTD file extension (e.g. "ctd")
}

export interface ImportedCTDSampleModel {
    sample_name: string;            // Matching EcoPart sample name
    ctd_import_utc_date_time: string;        // CTD import date (ISO string)
    file_extension: string;         // CTD file extension (e.g. "ctd")
}

export interface MinimalSampleRequestModel {
    sample_id?: number;                         // Sample internal identifier
    sample_name?: string;                       // Sample name
    project_id?: number;
}
export interface SampleIdModel {
    sample_id: number;
}
export interface PrivateSampleUpdateModel {
    sample_id: number;                         // Sample internal identifier
}
//TODO
export interface PrivateSampleUpdateModel {
}
//TODO
export interface PublicSampleUpdateModel extends PrivateSampleUpdateModel {
}

/* COMPUTE VIGNETTES */
export interface ComputeVignettesModel {
    gamma: number;              // gamma coefficiant of the gamma correction
    invert: string;             // invert image (black => white) : Values Y/N case insensitive
    scalebarsize_mm: number;    // size in millimeter of the scale bar
    keeporiginal: string;       // load original image in Ecotaxa in adition of the computer vignette : Values Y/N case insensitive
    fontcolor: string;          // color of the text in the footer (black or white), if white then background is black, else background is 254
    fontheight_px: number;      // height of the text in the footer in pixel
    footerheight_px: number;    // height of the footer in pixel
    scale: number;              // scale factor to resize the image, 1 = No change , >1 increase size using bucubic method
    Pixel_Size: number;         // pixel_size in micrometer will be added during sample generation, used to compute scalebar width
}

/* SAMPLE TYPE */
export interface SampleTypeModel {
    sample_type_id: number;
    sample_type_label: string;                 // Time série OR Depth profile
    sample_type_description: string;
}
export interface SampleTypeRequestModel {
    sample_type_id?: number;
    sample_type_label?: string;                 // Time série OR Depth profile
    sample_type_description?: string;
}
/* VISUAL QC STATUS */
export interface VisualQualityCheckStatusModel {
    visual_qc_status_id: number;
    visual_qc_status_label: string;                   // Can be pending, validated, rejected
}
export interface VisualQualityCheckStatusRequestModel {
    visual_qc_status_id?: number;
    visual_qc_status_label?: string;                   // Can be pending, validated, rejected
}

/* ECOTAXA IMPORT STATUS */
export interface EcoTaxaImportStatusModel {
    ecotaxa_import_status_id: number;
    ecotaxa_import_status_label: string;                   // Can be IN_PROGRESS, SUCCESS, ERROR
}
export interface EcoTaxaImportStatusRequestModel {
    ecotaxa_import_status_id?: number;
    ecotaxa_import_status_label?: string;                   // Can be IN_PROGRESS, SUCCESS, ERROR
}

/* HEADER */
export interface PublicHeaderSampleResponseModel {
    sample_name: string,
    raw_file_name: string,
    station_id: string,
    first_image: number,
    last_image: number,
    comment: string,
    qc_lvl1: boolean,
    qc_lvl1_comment: string,
    vignette_number: number,
}

export interface HeaderSampleModel {
    cruise: string,
    ship: string,
    filename: string,
    profileId: string,
    bottomDepth: number,
    ctdRosetteFilename: string,
    latitude: string,
    longitude: string,
    firstImage: number,
    volImage: number,
    aa: number,
    exp: number,
    dn: number,
    windDir: number,
    windSpeed: number,
    seaState: string,
    nebulousness: number,
    comment: string,
    endImg: number,
    yoyo: string,
    stationId: string,
    sampleType: string,
    integrationTime: number,
    argoId: string,
    pixelSize: number,
    sampleDateTime: string,
    constantdepth: number, // if profile is in time?
}

/* METADATA INI */
export interface MetadataIniSampleModel {
    sampleType: string;
    latitude_raw: string;
    longitude_raw: string;

    sample_name: string;                       // Sample name
    comment: string;                           // Optional comment
    instrument_serial_number: string;          // Instrument serial number
    station_id: string;                        // Station identifier
    sampling_utc_date_time: string;                     // Sampling date in ISO format
    wind_direction: number;                    // Wind direction (in degrees)
    wind_speed: number;                        // Wind speed (in relevant unit)
    sea_state: string;                         // Description or classification of sea state
    nebulousness: number;                      // Cloud coverage percentage (0-100)
    bottom_depth: number;                      // Bottom depth (in meters or relevant unit)
    instrument_operator_email: string;                    // Operator's email
    filename: string;                          // source file name

    filter_first_image: string;                // First image
    filter_last_image: string;                 // Last image

    instrument_settings_acq_gain: number;
    instrument_settings_acq_description: string | undefined;
    instrument_settings_acq_task_type: number | undefined;
    instrument_settings_acq_choice: number | undefined;
    instrument_settings_acq_disk_type: number | undefined;
    instrument_settings_acq_vignette_roi_enlargement_ratio: number;          // Renamed from acq_appendices_ratio
    instrument_settings_acq_x_size: number | undefined;
    instrument_settings_acq_y_size: number | undefined;
    instrument_settings_acq_erase_border: number | undefined;
    instrument_settings_acq_threshold: number;
    instrument_settings_acq_pressure_gain?: number;                          // UVP6 = 1
    instrument_settings_process_datetime: string | undefined;
    instrument_settings_process_vignette_resize_factor?: number;             // UVP6 from compute_vignettes scale factor
    instrument_settings_images_post_process: string;
    instrument_settings_aa: number;
    instrument_settings_exp: number;
    instrument_settings_image_volume_l: number;
    instrument_settings_pixel_size_mm: number;
    instrument_settings_depth_offset_m: number;
    instrument_settings_particule_minimum_area_pixels: number | undefined;   // Renamed; UVP6 will parse from data.txt ACQ_CONF (TODO position)
    instrument_settings_vignette_minimum_area_pixels: number | undefined;    // Renamed; UVP6 will parse from data.txt ACQ_CONF (TODO position)
    instrument_settings_acq_shutter_speed: number | undefined;
    instrument_settings_acq_exposure: number | undefined;
    instrument_settings_integration_time?: number;
}

/* FOR export */
export interface ExportSampleModel extends PublicSampleModel {
    filter_last_image_used: string,//TODO à déplacer : metadata à calculer au moment de export
    filter_removed_empty_slice: boolean,//TODO à déplacer : metadata à calculer au moment de export
    filter_filtered_rows: number,//TODO à déplacer : metadata à calculer au moment de export
    instrument_settings_acq_descent_filter: string,//TODO à déplacer 
}

/* FOR import UVP5 */
export interface SampleFromMetaHeaderModel {
    sample_name: string,                        // profilid
    comment: string,                            // comment
    instrument_serial_number: string,           // in file title : uvp5_header_snXXX
    station_id: string,                         // stationid
    sampling_utc_date_time: string,                      // filename?????
    latitude_raw: string,                       // latitude
    longitude_raw: string,                      // longitude
    wind_direction: number,                     // winddir
    wind_speed: number,                         // windspeed
    sea_state: string,                          // seastate
    nebulousness: number,                       // nebuloussness
    bottom_depth: number,                       // bottomdepth
    filename: string,                           // filename
    filter_first_image: string,                 // firstimage
    filter_last_image: string,                  // endimg
    sampleType: string,                         // yoyo
    instrument_settings_aa: number,             // aa
    instrument_settings_exp: number,            // exp
    instrument_settings_image_volume_l: number, // volimage

}
export interface SampleFromWorkDatfileModel {
    max_pressure: number,                       // maxpressure work/profileid/profileid_datfile.txt : 9;        20120520080214_203;        ***00150***;00356;003
}
export interface SampleFromWorkHDRModel {
    instrument_settings_acq_gain: number,                                       // Gain
    instrument_settings_acq_description: string,                                // 2e ligne du fichier (retirer le ;)
    instrument_settings_acq_task_type: number                                   // TaskType (-1 error, 0 save only, 1 process only, 2 mixt process, 3 full process)
    instrument_settings_acq_choice: number,                                     // Choice
    instrument_settings_acq_disk_type: number,                                  // DiskType
    instrument_settings_acq_vignette_roi_enlargement_ratio: number,             // HDR "Ratio" — crop window enlargement around the ROI
    instrument_settings_acq_erase_border: number,                               // EraseBorderBlobs
    instrument_settings_acq_threshold: number,                                  // Thresh
    instrument_settings_particule_minimum_area_pixels: number,                  // SMbase — minimum particle AREA in pixels²
    instrument_settings_vignette_minimum_area_pixels: number,                   // SMzoo — minimum vignette AREA in pixels²

    instrument_settings_acq_shutter_speed: number | undefined,                  // HDR Exposure (currently — see follow-up #8 about a likely swap)
    instrument_settings_acq_exposure: number | undefined                        // HDR ShutterSpeed (currently — see follow-up #8 about a likely swap)
}
export interface SampleFromCruiseInfoModel {
    instrument_operator_email: string,            // op_email
}
export interface SampleFromConfigurationDataModel {
    instrument_settings_acq_x_size: number,         // xsize
    instrument_settings_acq_y_size: number,         // ysize
    instrument_settings_pixel_size_mm: number,     // Pixel_Size
}
export interface SampleFromInstallConfigModel {
    instrument_settings_process_gamma: number,                                  // gamma
    instrument_settings_process_vignette_resize_factor?: number,                // UVP5SD = 2, UVP5HD = 1 (per Marc's spec; resize factor when saving vignettes)
}

/* Ecotaxa samples */

export interface EcoTaxaSampleListItem {
    sample_id: number;             // our internal id
    sample_name: string;
    ecotaxa_sample_id: number;     // EcoTaxa-side id
    nb_objects: number;            // sum of the four classification counts
    nb_unclassified: number;
    nb_validated: number;
    nb_dubious: number;
    nb_predicted: number;
}

export interface EcoTaxaSampleSummary {
    sample_id: number;
    sample_name: string;
    ecotaxa_sample_id: number;
}

export interface PublicImportableEcoTaxaSampleResponseModel {
    sample_id: number,
    sample_name: string,
    tsv_file_name: string,
    local_folder_tsv_path: string,
    images: number
}

