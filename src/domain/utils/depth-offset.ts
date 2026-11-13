// The depth offset a sample's depths use, as legacy EcoPart resolves it: the project override when
// set, otherwise the sample's own offset (UVP6 `metadata.ini` `Pressure_offset`; none in UVP5
// files), otherwise none. Every place that turns a pressure into a depth goes through it, so the QC
// graphs, the binned export, Explore and the exported metadata cannot disagree.
export function effectiveDepthOffset(
    project: { override_depth_offset?: number | null },
    sample: { instrument_settings_depth_offset_m?: number | null },
): number | null {
    return project.override_depth_offset ?? sample.instrument_settings_depth_offset_m ?? null;
}
