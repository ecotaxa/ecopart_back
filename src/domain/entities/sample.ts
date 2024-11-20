/* SAMPLE */

export interface SampleRequestCreationModel {
    sample_name: string;                       // Sample name
    comment: string;                           // Optional comment
    instrument_serial_number: string;          // Instrument serial number
    optional_structure_id?: string;                      // Optional id (Argo / Glider)
    max_pressure: number;                      // Maximum pressure (in relevant unit)
    station_id: string;                        // Station identifier
    sampling_date: string;                     // Sampling date in ISO format
    latitude: number;                          // Latitude (in decimal degrees) [DD.DDDD] (- for South)
    longitude: number;                         // Longitude (in decimal degrees) [DDD.DDDD] (- for West)
    wind_direction: number;                    // Wind direction (in degrees)
    wind_speed: number;                        // Wind speed (in relevant unit)
    sea_state: string;                         // Description or classification of sea state
    nebulousness: number;                      // Cloud coverage percentage (0-100)
    bottom_depth: number;                      // Bottom depth (in meters or relevant unit)
    instrument_operator_email: string;                    // Operator's email
    filename: string;                          // source file name

    filter_first_image: string;                // First image
    filter_last_image: string;                 // Last image

    instrument_settings_acq_gain: number;                        // Acquisition gain
    instrument_settings_acq_description: string | undefined;                 // Acquisition description
    instrument_settings_acq_task_type: number | undefined;                   // Acquisition task type
    instrument_settings_acq_choice: number | undefined;                     // Acquisition choice
    instrument_settings_acq_disk_type: number | undefined;                   // Acquisition disk type
    instrument_settings_acq_appendices_ratio: number;            // Acquisition ratio
    instrument_settings_acq_xsize: number | undefined;                       // Acquisition X size (in pixels or relevant unit)
    instrument_settings_acq_ysize: number | undefined;                       // Acquisition Y size (in pixels or relevant unit)
    instrument_settings_acq_erase_border: number | undefined;                // Acquisition erase border (0/1 boolean)
    instrument_settings_acq_threshold: number;                   // Acquisition threshold value
    instrument_settings_process_datetime: string | undefined;                // Process date and time (ISO format)
    instrument_settings_process_gamma: number | undefined                  // Process gamma value
    instrument_settings_images_post_process: string;             // Image post-processing details
    instrument_settings_aa: number;                              // Aa value for UVP6 (divided by 10^6)
    instrument_settings_exp: number;                             // Exp value
    instrument_settings_image_volume_l: number;                  // Image volume in liters
    instrument_settings_pixel_size_mm: number;                   // Pixel size in millimeters
    instrument_settings_depth_offset_m: number;                  // Depth offset in meters
    instrument_settings_particle_minimum_size_pixels: number | undefined;    // Particle minimum size in pixels
    instrument_settings_vignettes_minimum_size_pixels: number | undefined;   // Vignettes minimum size in pixels
    instrument_settings_particle_minimum_size_esd: number | undefined;      // Particle minimum size in esd
    instrument_settings_vignettes_minimum_size_esd: number | undefined;      // Vignettes minimum size in esd
    instrument_settings_acq_shutter: number | undefined;                     // Acquisition shutter
    instrument_settings_acq_shutter_speed: number | undefined;               // Acquisition shutter speed (in seconds or relevant unit)
    instrument_settings_acq_exposure: number | undefined;                    // Acquisition exposure (in seconds or relevant unit)

    visual_qc_validator_user_id: number;                      // Quality check validator user identifier
    sample_type_id: number;                                      // Sample type depth or time
    project_id: number;                                          // Project identifier    
}

export interface PrivateSampleModel extends SampleRequestCreationModel {
    sample_id: number;                         // Sample internal identifier
    sample_creation_date: string;                     // Creation date in ISO format
    visual_qc_status_id: number;               // Quality check status
}
export interface PublicSampleModel extends PrivateSampleModel {
    sample_type_label: string;                  // Sample type name
    visual_qc_status_label: string;                    // Quality check status
    visual_qc_validator_user: string;             // Quality check validator user name same format as "last_name first_name (email)"}
}
export interface SampleRequestModel {
    sample_id?: number;                         // Sample internal identifier
    sample_name?: string;                       // Sample name
    comment?: string;                           // Optional comment
    instrument_serial_number?: string;          // Instrument serial number
    optional_structure_id?: string;                      // Optional id (Argo / Glider)
    max_pressure?: number;                      // Maximum pressure (in relevant unit)
    station_id?: string;                        // Station identifier
    sampling_date?: string;                     // Sampling date in ISO format
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

    instrument_settings_acq_gain?: number;                        // Acquisition gain
    instrument_settings_acq_description?: string | undefined;                 // Acquisition description
    instrument_settings_acq_task_type?: number | undefined;                 // Acquisition task type
    instrument_settings_acq_choice?: number | undefined;                    // Acquisition choice
    instrument_settings_acq_disk_type?: number | undefined;                   // Acquisition disk type
    instrument_settings_acq_appendices_ratio?: number;                       // Acquisition ratio
    instrument_settings_acq_xsize?: number | undefined;                       // Acquisition X size (in pixels or relevant unit)
    instrument_settings_acq_ysize?: number | undefined;                       // Acquisition Y size (in pixels or relevant unit)
    instrument_settings_acq_erase_border?: number | undefined;                // Acquisition erase border (0/1 boolean)
    instrument_settings_acq_threshold?: number;                   // Acquisition threshold value
    instrument_settings_process_datetime?: string | undefined;                // Process date and time (ISO format)
    instrument_settings_process_gamma?: number;                   // Process gamma value
    instrument_settings_images_post_process?: string;             // Image post-processing details
    instrument_settings_aa?: number;                              // Aa value for UVP6 (divided by 10^6)
    instrument_settings_exp?: number;                             // Exp value
    instrument_settings_image_volume_l?: number;                  // Image volume in liters
    instrument_settings_pixel_size_mm?: number;                   // Pixel size in millimeters
    instrument_settings_depth_offset_m?: number;                  // Depth offset in meters
    instrument_settings_particle_minimum_size_pixels?: number | undefined;    // Particle minimum size in pixels
    instrument_settings_vignettes_minimum_size_pixels?: number | undefined;   // Vignettes minimum size in pixels
    instrument_settings_particle_minimum_size_esd?: number | undefined;      // Particle minimum size in esd
    instrument_settings_vignettes_minimum_size_esd?: number | undefined;      // Vignettes minimum size in esd
    instrument_settings_acq_shutter_speed?: number | undefined;               // Acquisition shutter speed (in seconds or relevant unit)
    instrument_settings_acq_exposure?: number | undefined;                    // Acquisition exposure (in seconds or relevant unit)

    visual_qc_validator_user_id?: number;                      // Quality check validator user identifier
    sample_type_id?: number;                                      // Sample type depth or time
    project_id?: number;                                          // Project identifier
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
}

/* METADATA INI */
export interface MetadataIniSampleModel {
    sampleType: string;
    latitude_raw: string;
    longitude_raw: string;

    sample_name: string;                       // Sample name
    comment: string;                           // Optional comment
    instrument_serial_number: string;          // Instrument serial number
    optional_structure_id?: string;                      // Optional id (Argo / Glider)
    station_id: string;                        // Station identifier
    sampling_date: string;                     // Sampling date in ISO format
    wind_direction: number;                    // Wind direction (in degrees)
    wind_speed: number;                        // Wind speed (in relevant unit)
    sea_state: string;                         // Description or classification of sea state
    nebulousness: number;                      // Cloud coverage percentage (0-100)
    bottom_depth: number;                      // Bottom depth (in meters or relevant unit)
    instrument_operator_email: string;                    // Operator's email
    filename: string;                          // source file name

    filter_first_image: string;                // First image
    filter_last_image: string;                 // Last image

    instrument_settings_acq_gain: number;                        // Acquisition gain
    instrument_settings_acq_description: string | undefined;                 // Acquisition description
    instrument_settings_acq_task_type: number | undefined;                   // Acquisition task type
    instrument_settings_acq_choice: number | undefined;                     // Acquisition choice
    instrument_settings_acq_disk_type: number | undefined;                   // Acquisition disk type
    instrument_settings_acq_appendices_ratio: number;            // Acquisition ratio
    instrument_settings_acq_xsize: number | undefined;                       // Acquisition X size (in pixels or relevant unit)
    instrument_settings_acq_ysize: number | undefined;                       // Acquisition Y size (in pixels or relevant unit)
    instrument_settings_acq_erase_border: number | undefined;                // Acquisition erase border (0/1 boolean)
    instrument_settings_acq_threshold: number;                   // Acquisition threshold value
    instrument_settings_process_datetime: string | undefined;                // Process date and time (ISO format)
    instrument_settings_images_post_process: string;             // Image post-processing details
    instrument_settings_aa: number;                              // Aa value for UVP6 (divided by 10^6)
    instrument_settings_exp: number;                             // Exp value
    instrument_settings_image_volume_l: number;                  // Image volume in liters
    instrument_settings_pixel_size_mm: number;                   // Pixel size in millimeters
    instrument_settings_depth_offset_m: number;                  // Depth offset in meters
    instrument_settings_particle_minimum_size_pixels: number | undefined;    // Particle minimum size in pixels
    instrument_settings_vignettes_minimum_size_pixels: number | undefined;   // Vignettes minimum size in pixels
    instrument_settings_particle_minimum_size_esd: number | undefined;      // Particle minimum size in esd
    instrument_settings_vignettes_minimum_size_esd: number | undefined;      // Vignettes minimum size in esd
    instrument_settings_acq_shutter: number | undefined;                     // Acquisition shutter
    instrument_settings_acq_shutter_speed: number | undefined;               // Acquisition shutter speed (in seconds or relevant unit)
    instrument_settings_acq_exposure: number | undefined;                    // Acquisition exposure (in seconds or relevant unit)
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
    sampling_date: string,                      // filename?????
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
    instrument_settings_acq_gain: number,                       // Gain
    instrument_settings_acq_description: string,                // 2e ligne du fichier (retirer le ;)
    instrument_settings_acq_task_type: number                   // TaskType
    instrument_settings_acq_choice: number,                     // Choice
    instrument_settings_acq_disk_type: number,                  // DiskType
    instrument_settings_acq_appendices_ratio: number,           // Ratio
    instrument_settings_acq_erase_border: number,               // EraseBorderBlobs
    instrument_settings_acq_threshold: number,                  // Thresh
    instrument_settings_particle_minimum_size_pixels: number,   // SMbase
    instrument_settings_vignettes_minimum_size_pixels: number,  // SMzoo

    instrument_settings_acq_shutter_speed: number | undefined,              // Exposure UVP5HD       ????????? #TODO
    instrument_settings_acq_exposure: number | undefined                    // ShutterSpeed UVP5SD   ????????? #TODO

}
export interface SampleFromCruiseInfoModel {
    instrument_operator_email: string,            // op_email
}
export interface SampleFromConfigurationDataModel {
    instrument_settings_acq_xsize: number,         // xsize
    instrument_settings_acq_ysize: number,         // ysize
    instrument_settings_pixel_size_mm: number,     // Pixel_Size
}
export interface SampleFromInstallConfigModel {
    instrument_settings_process_gamma: number,    // gamma
    instrument_settings_vignettes_minimum_size_esd: number, // esdmin
}