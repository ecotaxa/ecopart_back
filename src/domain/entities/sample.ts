
export interface PublicSampleResponseModel {
    sample_name: string,
    raw_file_name: string,
    station_id: string,
    first_image: string,
    last_image: string,
    comment: string,
    qc_lvl1: boolean,
    qc_lvl1_comment: string,
}

export interface PublicHeaderSampleResponseModel {
    sample_name: string,
    raw_file_name: string,
    station_id: string,
    first_image: string,
    last_image: string,
    comment: string,
    qc_lvl1: boolean,
    qc_lvl1_comment: string,
}

export interface HeaderSampleModel {
    cruise: string;
    ship: string;
    filename: string;
    profileId: string;
    bottomDepth: string;
    ctdRosetteFilename: string;
    latitude: string;
    longitude: string;
    firstImage: string;
    volImage: string;
    aa: string;
    exp: string;
    dn: string;
    windDir: string;
    windSpeed: string;
    seaState: string;
    nebulousness: string;
    comment: string;
    endImg: string;
    yoyo: string;
    stationId: string;
    sampleType: string | undefined;
    integrationTime: string | undefined;
    argoId: string | undefined;
    pixelSize: string | undefined;
    sampleDateTime: string | undefined;
}