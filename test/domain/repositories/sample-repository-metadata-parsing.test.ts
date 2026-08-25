import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";

// All the parsers exercised here are pure (string in, model out), so a dummy datasource is fine.
const repo = new SampleRepositoryImpl({} as any, "");

// Trimmed-down copy of a real UVP6 metadata.ini (uvp6_endtoend_TEST /
// ALR006_20240611_0001_0000_x0001_Particule/metadata.ini) — keys and values are verbatim.
const UVP6_METADATA_INI = `[HW_CONF]
Aa=2300.000
Camera_ref=000213LP
Exp=1.136
Gain=6
Image_volume=0.530
Operator_email=peter.lambert@noc.ac.uk
Pixel_Size=73
Pressure_offset=0.000
Shutter=52
Threshold=20

[ACQ_CONF]
Appendices_ratio=1.5
Limit_lpm_detection_size=10
Operator_email=peter.lambert@noc.ac.uk
Vignetting_lower_limit_size=620

[sample_metadata]
cruise=DY180
ship=ALR006
filename=20240612-001310
profileid=ALR006_20240611_0001_0000_x0001
bottomdepth=NA
ctdrosettefilename=ALR006_20240611_0001_0000_x0001.ctd
latitude=63.3476
longitude=-20.2736
firstimage=0
winddir=NA
windspeed=NA
seastate=NA
nebuloussness=NA
comment=NA
endimg=2469
yoyo=NA
stationid=segment_0
sampletype=P
integrationtime=5
sampledatetime=20240612-001312
`;

describe("parseIniContent (UVP6 metadata.ini)", () => {
    test("reads the acquisition settings straight from HW_CONF / ACQ_CONF", () => {
        const sample = repo.parseIniContent(UVP6_METADATA_INI);

        expect(sample.sample_name).toBe("ALR006_20240611_0001_0000_x0001");
        expect(sample.instrument_serial_number).toBe("000213LP");
        expect(sample.instrument_settings_acq_gain).toBe(6);
        expect(sample.instrument_settings_acq_threshold).toBe(20);
        expect(sample.instrument_settings_acq_vignette_roi_enlargement_ratio).toBe(1.5);
        expect(sample.instrument_settings_image_volume_l).toBe(0.53);
        expect(sample.instrument_settings_aa).toBe(2300);
        expect(sample.instrument_settings_exp).toBe(1.136);
        // Kept raw, in µm on the UVP6 — the unit is instrument-dependent, see the export README.
        expect(sample.instrument_settings_pixel_size_mm).toBe(73);
        expect(sample.instrument_settings_acq_pressure_gain).toBe(1);
        expect(sample.instrument_settings_images_post_process).toBe("uvpapp");
    });

    test("HW_CONF.Shutter is the exposure in µs; the UVP5SD shutter code stays empty", () => {
        const sample = repo.parseIniContent(UVP6_METADATA_INI);

        expect(sample.instrument_settings_acq_exposure).toBe(52);
        expect(sample.instrument_settings_acq_shutter_speed).toBeUndefined();
    });

    test("integrationtime is read from [sample_metadata] and tolerates the `nan` placeholder", () => {
        expect(repo.parseIniContent(UVP6_METADATA_INI).instrument_settings_integration_time).toBe(5);

        const nan_ini = UVP6_METADATA_INI.replace("integrationtime=5", "integrationtime=nan");
        expect(repo.parseIniContent(nan_ini).instrument_settings_integration_time).toBeUndefined();

        const missing_ini = UVP6_METADATA_INI.replace("integrationtime=5\n", "");
        expect(repo.parseIniContent(missing_ini).instrument_settings_integration_time).toBeUndefined();
    });

    test("ESD limits are converted to an area in pixels (legacy calcpixelfromesd_aa_exp)", () => {
        const sample = repo.parseIniContent(UVP6_METADATA_INI);

        // Vignetting_lower_limit_size = 620 µm → 0.62 mm ESD, Aa 2300 (=0.0023 mm²/px), Exp 1.136:
        // floor(((π / 0.0023) × 0.31²) ^ (1/1.136)) = 73 px
        expect(sample.instrument_settings_vignette_minimum_area_pixels).toBe(73);
        // Limit_lpm_detection_size = 10 µm → 0.01 mm ESD → below one pixel → 0
        expect(sample.instrument_settings_particule_minimum_area_pixels).toBe(0);
    });

    test("an absent ESD limit leaves the area empty instead of NaN", () => {
        const ini = UVP6_METADATA_INI.replace("Vignetting_lower_limit_size=620\n", "");
        expect(repo.parseIniContent(ini).instrument_settings_vignette_minimum_area_pixels).toBeUndefined();

        // A key present with a blank value is a different story: parseIniContent turns "" into 0
        // (Number("") === 0), so the area legitimately computes to 0 rather than staying empty.
        const blank = UVP6_METADATA_INI.replace("Vignetting_lower_limit_size=620", "Vignetting_lower_limit_size=");
        expect(repo.parseIniContent(blank).instrument_settings_vignette_minimum_area_pixels).toBe(0);
    });

    test("the depth offset is only kept inside the legacy sanity range 0 <= offset < 100", () => {
        expect(repo.parseIniContent(UVP6_METADATA_INI).instrument_settings_depth_offset_m).toBe(0);

        const in_range = UVP6_METADATA_INI.replace("Pressure_offset=0.000", "Pressure_offset=1.2");
        expect(repo.parseIniContent(in_range).instrument_settings_depth_offset_m).toBe(1.2);

        const too_big = UVP6_METADATA_INI.replace("Pressure_offset=0.000", "Pressure_offset=999");
        expect(repo.parseIniContent(too_big).instrument_settings_depth_offset_m).toBeUndefined();

        const negative = UVP6_METADATA_INI.replace("Pressure_offset=0.000", "Pressure_offset=-1");
        expect(repo.parseIniContent(negative).instrument_settings_depth_offset_m).toBeUndefined();
    });
});

describe("parseMetaHeader (UVP5 / UVP6 meta header)", () => {
    // 21-column UVP5 header shipped by Zooprocess (uvp5_sn002zd_omer_2), verbatim.
    const UVP5_HEADER = [
        "cruise;ship;filename;profileid;bottomdepth;ctdrosettefilename;latitude;longitude;firstimage;volimage;aa;exp;dn;winddir;windspeed;seastate;nebuloussness;comment;endimg;yoyo;stationid",
        "sn002zd_omer_2;europe;20120520080213;omer2_1;82;omer2_1;43.4111;7.1901;579;0.48;0.0014;1.397;D;300;6;1;8;water_sampling;871;N;omer2_1",
    ].join("\n");

    // Extended header (uvp6_sn000158hf_20230406_ae2307): adds sampletype, integrationtime,
    // argoid, pixelsize and sampledatetime after stationid.
    const EXTENDED_HEADER = [
        "cruise;ship;filename;profileid;bottomdepth;ctdrosettefilename;latitude;longitude;firstimage;volimage;aa;exp;dn;winddir;windspeed;seastate;nebuloussness;comment;endimg;yoyo;stationid;sampletype;integrationtime;argoid;pixelsize;sampledatetime",
        "ae2307;RV Atlantic Explorer;20230406-133013;HS1447C1;nan;HS1447C1;3210 0;-6429 57;7546;0.690;0.0023;1.136;;nan;nan;nan;nan;a comment;69979;;HS1447C1;P;5;;73;20230406-144332-820",
    ].join("\n");

    test("the 21-column format has no integrationtime column — the field stays empty", () => {
        const sample = repo.parseMetaHeader(UVP5_HEADER, "uvp5_header_sn002zd_omer_2.txt", "omer2_1");

        expect(sample.instrument_serial_number).toBe("002");
        expect(sample.instrument_settings_aa).toBe(0.0014);
        expect(sample.instrument_settings_exp).toBe(1.397);
        expect(sample.instrument_settings_image_volume_l).toBe(0.48);
        expect(sample.instrument_settings_integration_time).toBeUndefined();
    });

    test("the extended format fills integrationtime, and a `nan` cell does not become NaN", () => {
        const sample = repo.parseMetaHeader(EXTENDED_HEADER, "uvp6_header_sn000158hf_20230406_ae2307.txt", "HS1447C1");
        expect(sample.instrument_settings_integration_time).toBe(5);

        const nan_header = EXTENDED_HEADER.replace(";P;5;", ";P;nan;");
        const nan_sample = repo.parseMetaHeader(nan_header, "uvp6_header_sn000158hf_20230406_ae2307.txt", "HS1447C1");
        expect(nan_sample.instrument_settings_integration_time).toBeUndefined();
    });
});

describe("parseWorkHDR (UVP5 work/HDR*.txt)", () => {
    // Real UVP5SD HDR (uvp5_sn002zd_omer_2/results/HDR20120520080213.txt): it carries ShutterSpeed
    // but no Exposure key. UVP5HD HDRs (uvp5_sn201_exports01) carry `Exposure` in µs instead.
    const UVP5SD_HDR = `[General]
; -1 : error, 0 : Save only, 1 : Process only, 2 : Mixt process, 3 : Full process
TaskType=2
; -1 : error, 0 : FD, 1 : HD
DiskType=0
ShutterSpeed=12
Gain=6
Threshold=512

[Processing]
Thresh=21
SMbase=0
SMzoo=30
EraseBorderBlobs=0

[Picture]
Choice=1
Ratio=3
`;

    test("ShutterSpeed feeds the shutter-speed code and Exposure the exposure — not the reverse", () => {
        const sample = repo.parseWorkHDR(UVP5SD_HDR);

        expect(sample.instrument_settings_acq_shutter_speed).toBe(12);
        expect(sample.instrument_settings_acq_exposure).toBeUndefined();

        const hd_hdr = UVP5SD_HDR.replace("ShutterSpeed=12", "ShutterSpeed=12\nExposure= 160");
        const hd_sample = repo.parseWorkHDR(hd_hdr);
        expect(hd_sample.instrument_settings_acq_shutter_speed).toBe(12);
        expect(hd_sample.instrument_settings_acq_exposure).toBe(160);
    });

    test("the processing section feeds the min-area fields and the acquisition flags", () => {
        const sample = repo.parseWorkHDR(UVP5SD_HDR);

        // SMbase = 0 is a real value on this dataset, not a parse failure.
        expect(sample.instrument_settings_particule_minimum_area_pixels).toBe(0);
        expect(sample.instrument_settings_vignette_minimum_area_pixels).toBe(30);
        expect(sample.instrument_settings_acq_threshold).toBe(21);
        expect(sample.instrument_settings_acq_gain).toBe(6);
        expect(sample.instrument_settings_acq_task_type).toBe(2);
        expect(sample.instrument_settings_acq_disk_type).toBe(0);
        expect(sample.instrument_settings_acq_choice).toBe(1);
        expect(sample.instrument_settings_acq_vignette_roi_enlargement_ratio).toBe(3);
        expect(sample.instrument_settings_acq_erase_border).toBe(0);
    });
});
