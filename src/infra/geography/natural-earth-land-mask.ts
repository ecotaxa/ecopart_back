import { readFileSync } from "fs";
import path from "path";
import type { MultiPolygon, Polygon, Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { LandMask } from "../../domain/interfaces/geography/land-mask";

// Natural Earth land at 1:10m, the finest scale world-atlas ships: unlike the 1:50m one the maps
// draw, it keeps the fjords open. It still closes the narrowest bays and straits.
const LAND_TOPOLOGY = "world-atlas/land-10m.json";
// The land above covers every lake but the Caspian Sea: the Natural Earth 1:10m lakes are taken out
// of it. Written by tools/buildLakes.ts, one object per layer.
const LAKES_TOPOLOGY = path.join(__dirname, "data", "ne-10m-lakes.json");
// The edges are indexed by the band of longitude they cross, so a lookup only reads a few hundred.
const BAND_DEGREES = 0.1;
const NB_BANDS = Math.round(360 / BAND_DEGREES);

// A longitude difference brought back to [-180, 180), so an edge across the antimeridian stays short.
const wrapDelta = (delta: number): number => ((delta + 180) % 360 + 360) % 360 - 180;
const bandOf = (longitude: number): number => ((Math.floor(longitude / BAND_DEGREES) % NB_BANDS) + NB_BANDS) % NB_BANDS;

function ringsOf(topology: Topology, name: string): Position[][] {
    return feature(topology, topology.objects[name] as GeometryCollection).features.flatMap(({ geometry }) => {
        const shape = geometry as Polygon | MultiPolygon;
        return shape.type === "MultiPolygon" ? shape.coordinates.flat() : shape.coordinates;
    });
}

const readTopology = (file: string): Topology => JSON.parse(readFileSync(file, "utf8")) as Topology;

function loadLandRings(): Position[][] {
    return ringsOf(readTopology(require.resolve(LAND_TOPOLOGY)), "land");
}

// One set of rings per layer: the regional supplements repeat some lakes of the world layer.
function loadLakeLayers(): Position[][][] {
    const topology = readTopology(LAKES_TOPOLOGY);
    return Object.keys(topology.objects).map(name => ringsOf(topology, name));
}

// Point in polygon on the sphere: count the edges the meridian crosses between the position and
// the South Pole. Each one switches between inside and outside; the pole itself is inside as many
// times as rings go round it.
class RingIndex {
    private readonly bands: Float64Array[];        // per band, the edges crossing it: longitude, latitude, delta longitude, delta latitude
    private readonly south_polar_rings: number;    // rings around the South Pole (Antarctica)

    constructor(rings: Position[][]) {
        const bands: number[][] = Array.from({ length: NB_BANDS }, () => []);
        let south_polar_rings = 0;
        for (const ring of rings) {
            let winding = 0;
            for (let i = 0; i + 1 < ring.length; i++) {
                const [longitude, latitude] = ring[i];
                const delta = wrapDelta(ring[i + 1][0] - longitude);
                winding += delta;
                if (delta === 0) continue;
                const first = Math.floor(Math.min(longitude, longitude + delta) / BAND_DEGREES);
                const last = Math.floor(Math.max(longitude, longitude + delta) / BAND_DEGREES);
                for (let band = first; band <= last; band++) {
                    bands[((band % NB_BANDS) + NB_BANDS) % NB_BANDS].push(longitude, latitude, delta, ring[i + 1][1] - latitude);
                }
            }
            // A ring whose longitudes wind a full turn goes round a pole.
            if (Math.abs(winding) > 180 && ring.some(([, latitude]) => latitude < 0)) south_polar_rings++;
        }
        this.bands = bands.map(edges => Float64Array.from(edges));
        this.south_polar_rings = south_polar_rings;
    }

    contains(latitude: number, longitude: number): boolean {
        const edges = this.bands[bandOf(longitude)];
        let crossings = this.south_polar_rings;
        for (let i = 0; i < edges.length; i += 4) {
            const from = wrapDelta(edges[i] - longitude);
            const to = from + edges[i + 2];
            if ((from < 0) === (to < 0)) continue;
            if (edges[i + 1] + edges[i + 3] * (-from / edges[i + 2]) < latitude) crossings++;
        }
        return crossings % 2 === 1;
    }
}

// Inside the land and outside every lake. Read once, on the first lookup.
export class NaturalEarthLandMask implements LandMask {
    private land: RingIndex | null = null;
    private lakes: RingIndex[] = [];

    constructor(
        private readonly loadLand: () => Position[][] = loadLandRings,
        private readonly loadLakes: () => Position[][][] = loadLakeLayers,
    ) { }

    isOnLand(latitude: number, longitude: number): boolean {
        if (!this.land) {
            this.land = new RingIndex(this.loadLand());
            this.lakes = this.loadLakes().map(rings => new RingIndex(rings));
        }
        return this.land.contains(latitude, longitude) && !this.lakes.some(lake => lake.contains(latitude, longitude));
    }
}
