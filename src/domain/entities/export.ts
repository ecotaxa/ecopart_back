// Format of the tables EcoPart generates in an export archive: the metadata tables of every
// product and the particle table of the binned export. The files copied as imported (particle
// archives, vignettes, instrument configuration, CTD files, EcoTaxa archives) are not tables.
export type ExportTableFormat = "tsv" | "parquet";
