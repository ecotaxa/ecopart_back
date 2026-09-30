// Standard CTD column titles (lower-cased), as in legacy EcoPart `constants.py` `CTDFixedCol`.
// Any other column of a CTD file is a custom parameter and is listed in `sample.ctd_description`.
export const CTD_STANDARD_COLUMNS: ReadonlySet<string> = new Set([
    "chloro fluo [mg chl m-3]",
    "conductivity [ms cm-1]",
    "cpar [%]",
    "depth [m]",
    "fcdom [ppb qse]",
    "in situ density anomaly [kg m-3]",
    "nitrate [umol l-1]",
    "oxygen [umol kg-1]",
    "oxygen [ml l-1]",
    "par [umol m-2 s-1]",
    "potential density anomaly [kg m-3]",
    "potential temperature [degc]",
    "practical salinity [psu]",
    "pressure [db]",
    "qc flag",
    "spar [umol m-2 s-1]",
    "temperature [degc]",
    "time [yyyymmddhhmmssmmm]",
]);

// Alternative spellings accepted for standard columns (legacy `common_sample_import.py` ImportCTD).
export const CTD_COLUMN_ALIASES: Readonly<Record<string, string>> = {
    "chloro fluo [mg chl/m3]": "chloro fluo [mg chl m-3]",
    "conductivity [ms/cm]": "conductivity [ms cm-1]",
    "depth [salt water, m]": "depth [m]",
    "fcdom factory [ppb qse]": "fcdom [ppb qse]",
    "in situ density anomaly [kg/m3]": "in situ density anomaly [kg m-3]",
    "nitrate [µmol/l]": "nitrate [umol l-1]",
    "oxygen [µmol/kg]": "oxygen [umol kg-1]",
    "oxygen [ml/l]": "oxygen [ml l-1]",
    "par [µmol m-2 s-1]": "par [umol m-2 s-1]",
    "potential density anomaly [kg/m3]": "potential density anomaly [kg m-3]",
    "pressure in water column [db]": "pressure [db]",
    "spar [µmol m-2 s-1]": "spar [umol m-2 s-1]",
};

// Position columns (lower-cased) read at CTD import into `sample.ctd_latitude` / `ctd_longitude`.
// Not part of legacy `CTDFixedCol`, so they stay listed in `ctd_description` as custom columns.
export const CTD_LATITUDE_COLUMNS: ReadonlySet<string> = new Set(["lat", "latitude"]);
export const CTD_LONGITUDE_COLUMNS: ReadonlySet<string> = new Set(["lon", "long", "longitude"]);
