import { writeFileSync } from "fs";
import path from "path";
import type { FeatureCollection } from "geojson";
import { topology } from "topojson-server";

// Writes src/infra/geography/data/ne-10m-lakes.json, the lakes the land mask takes out of the land:
// the Natural Earth 1:10m lakes (public domain) and their regional supplements, geometry only,
// quantized like world-atlas. The historic and pluvial lakes are dry and left out.
// Run: npx ts-node tools/buildLakes.ts
const NATURAL_EARTH = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson";
const LAYERS = ["lakes", "lakes_europe", "lakes_north_america", "lakes_australia"];
const QUANTIZATION = 1e5;
const OUTPUT = path.resolve(__dirname, "../src/infra/geography/data/ne-10m-lakes.json");

async function main(): Promise<void> {
    const objects: Record<string, FeatureCollection> = {};
    for (const layer of LAYERS) {
        const response = await fetch(`${NATURAL_EARTH}/ne_10m_${layer}.geojson`);
        if (!response.ok) throw new Error(`Cannot download ne_10m_${layer}: HTTP ${response.status}`);
        const collection = await response.json() as FeatureCollection;
        objects[layer] = {
            type: "FeatureCollection",
            features: collection.features.filter(feature => feature.geometry).map(feature => ({ type: "Feature", properties: {}, geometry: feature.geometry })),
        };
    }
    writeFileSync(OUTPUT, JSON.stringify(topology(objects, QUANTIZATION)));
    console.log(`Wrote ${OUTPUT}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
