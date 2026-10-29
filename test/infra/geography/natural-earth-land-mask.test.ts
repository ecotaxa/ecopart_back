import { isInland } from "../../../src/domain/use-cases/project/project-stats";
import { NaturalEarthLandMask } from "../../../src/infra/geography/natural-earth-land-mask";

describe("NaturalEarthLandMask", () => {
    const land = new NaturalEarthLandMask();

    test.each([
        ["Paris", 48.85, 2.35],
        ["Lyon", 45.76, 4.83],
        ["the South Pole", -89.99, 0],
        ["Viti Levu, next to the antimeridian", -17.8, 178.4],
        ["Chukotka, next to the antimeridian", 66, 179.9],
        ["the shore of Lake Geneva, outside the lake", 46.52, 6.63],
    ])("%s is on land", (_place, latitude, longitude) => {
        expect(land.isOnLand(latitude, longitude)).toBe(true);
    });

    test.each([
        ["DYFAMED, Ligurian Sea", 43.42, 7.87],
        ["Point B, off Villefranche", 43.685, 7.316],
        ["the Caspian Sea, a hole in Eurasia", 42, 50.5],
        ["the Weddell Sea, off Antarctica", -70, -40],
        ["the North Pole", 89.99, 0],
        ["Kongsfjorden, Svalbard", 78.95, 11.9],
        ["the Sognefjord, which the 1:50m map fills", 61.1, 6.5],
    ])("%s is at sea", (_place, latitude, longitude) => {
        expect(land.isOnLand(latitude, longitude)).toBe(false);
    });

    test.each([
        ["Lake Geneva", 46.45, 6.55],
        ["Lac du Bourget, from the European supplement", 45.73, 5.87],
        ["Lake Baikal", 53.5, 108],
        ["Lake Victoria", -1, 33],
        ["Lake Superior", 47.6, -87.5],
        ["Lake Titicaca", -15.8, -69.4],
        ["the Great Salt Lake, an alkaline lake", 41.1, -112.5],
    ])("%s is not on land", (_place, latitude, longitude) => {
        expect(land.isOnLand(latitude, longitude)).toBe(false);
    });

    test("a longitude beyond 180° reads as its equivalent", () => {
        expect(land.isOnLand(48.85, 2.35 + 360)).toBe(true);
        expect(land.isOnLand(43.42, 7.87 - 360)).toBe(false);
    });

    test("reads the land and the lakes once, on the first lookup", () => {
        const loadLand = jest.fn(() => [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]]);
        // Two layers, the second one repeating the lake of the first.
        const lake = [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]];
        const loadLakes = jest.fn(() => [[lake], [lake, [[3, 3], [3.5, 3], [3.5, 3.5], [3, 3.5], [3, 3]]]]);
        const square = new NaturalEarthLandMask(loadLand, loadLakes);

        expect(loadLand).toBeCalledTimes(0);
        expect(square.isOnLand(0.5, 0.5)).toBe(true);
        expect(square.isOnLand(1.5, 1.5)).toBe(false);
        expect(square.isOnLand(3.2, 3.2)).toBe(false);
        expect(square.isOnLand(0.5, 4.5)).toBe(false);
        expect(loadLand).toBeCalledTimes(1);
        expect(loadLakes).toBeCalledTimes(1);
    });

    describe("with the coastal margin of the project statistics", () => {
        test.each([
            ["the Villefranche bay, closed at 1:10m", 43.69, 7.31],
            ["the Roscoff pier", 48.73, -3.98],
            ["the Bosphorus, closed at 1:10m", 41.1, 29.05],
            ["0°N 0°E, on Natural Earth's 1 km Null Island", 0, 0],
        ])("%s is not inland", (_place, latitude, longitude) => {
            expect(land.isOnLand(latitude, longitude)).toBe(true);
            expect(isInland(land, latitude, longitude)).toBe(false);
        });

        test("a position swapped or with the wrong sign deep in a continent is", () => {
            expect(isInland(land, 45.76, 4.83)).toBe(true);
            expect(isInland(land, 7.87, 43.42)).toBe(true);
        });
    });
});
