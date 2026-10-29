// Tells land from water, for the warnings on sample positions.
export interface LandMask {
    // True when the position, in decimal degrees, falls on land: inside the land, outside the lakes.
    isOnLand(latitude: number, longitude: number): boolean;
}
