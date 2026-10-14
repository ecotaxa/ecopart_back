import request from "supertest";
import server from "../../src/server";

// A response the size of the QC graphs of a few samples.
const BIG_JSON = { points: Array.from({ length: 5000 }, (_, i) => ({ image_index: i, depth_m: i / 10, is_selected: true })) };

server.get("/test-compression/json", (_req, res) => { res.json(BIG_JSON); });
server.get("/test-compression/zip", (_req, res) => { res.type("application/zip").send(Buffer.alloc(100_000)); });

describe("response compression", () => {
    test("gzips a JSON response for a client that accepts it", async () => {
        const response = await request(server).get("/test-compression/json").set("Accept-Encoding", "gzip");

        expect(response.headers["content-encoding"]).toBe("gzip");
        expect(response.body).toEqual(BIG_JSON);
    });

    test("leaves the response as it is for a client that does not accept gzip", async () => {
        const response = await request(server).get("/test-compression/json").set("Accept-Encoding", "identity");

        expect(response.headers["content-encoding"]).toBeUndefined();
        expect(response.body).toEqual(BIG_JSON);
    });

    test("does not compress an archive again", async () => {
        const response = await request(server).get("/test-compression/zip").set("Accept-Encoding", "gzip");

        expect(response.headers["content-encoding"]).toBeUndefined();
        expect(response.headers["content-length"]).toBe("100000");
    });
});
