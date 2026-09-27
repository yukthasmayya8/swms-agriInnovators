import request from "supertest";
import { Worker } from "bullmq";
import { app, createTestUser, closeDb, pollUntil } from "./helpers";
import { startGisWorker } from "../src/workers/gis.worker";

describe("GIS Map Layers (REQ-03)", () => {
  let plannerToken: string;
  let habitationId: string;
  let worker: Worker;

  beforeAll(async () => {
    worker = startGisWorker();
    await createTestUser("gis-planner@test.dev", "planner");
    const login = await request(app).post("/api/auth/login").send({ email: "gis-planner@test.dev", password: "Password123!" });
    plannerToken = login.body.data.accessToken;

    const hab = await request(app)
      .post("/api/habitations")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ name: "GIS Test Town", type: "town", latitude: 13.2, longitude: 74.7 });
    habitationId = hab.body.data.id;
  });
  afterAll(async () => {
    await worker.close();
    await closeDb();
  });

  test("T-07: valid GeoJSON upload -> 201 processing, then ready once the worker completes", async () => {
    const geojson = JSON.stringify({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [74.7, 13.2] } }]
    });

    const uploadRes = await request(app)
      .post(`/api/habitations/${habitationId}/map-layers`)
      .set("Authorization", `Bearer ${plannerToken}`)
      .field("layerType", "settlement")
      .attach("file", Buffer.from(geojson), "settlement.geojson");

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.status).toBe("processing");
    const layerId = uploadRes.body.data.id;

    const layer = await pollUntil(
      async () => {
        const res = await request(app).get(`/api/habitations/${habitationId}/map-layers`).set("Authorization", `Bearer ${plannerToken}`);
        return res.body.data.find((l: any) => l.id === layerId);
      },
      (l) => l && l.status !== "processing"
    );

    expect(layer.status).toBe("ready");
  });

  test("T-08: corrupted/unsupported file content -> layer status becomes failed with a readable reason", async () => {
    const uploadRes = await request(app)
      .post(`/api/habitations/${habitationId}/map-layers`)
      .set("Authorization", `Bearer ${plannerToken}`)
      .field("layerType", "road")
      .attach("file", Buffer.from("{ this is not valid geojson"), "broken.geojson");

    expect(uploadRes.status).toBe(201);
    const layerId = uploadRes.body.data.id;

    const layer = await pollUntil(
      async () => {
        const res = await request(app).get(`/api/habitations/${habitationId}/map-layers`).set("Authorization", `Bearer ${plannerToken}`);
        return res.body.data.find((l: any) => l.id === layerId);
      },
      (l) => l && l.status !== "processing"
    );

    expect(layer.status).toBe("failed");
    expect(layer.failure_reason).toMatch(/invalid JSON/i);
  });
});
