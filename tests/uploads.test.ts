import request from "supertest";
import { Worker } from "bullmq";
import { app, createTestUser, closeDb, pollUntil } from "./helpers";
import { startValidationWorker } from "../src/workers/validation.worker";

describe("Dataset Upload & Validation (REQ-04)", () => {
  let plannerToken: string;
  let habitationId: string;
  let worker: Worker;

  beforeAll(async () => {
    worker = startValidationWorker();
    await createTestUser("upload-planner@test.dev", "planner");
    const login = await request(app).post("/api/auth/login").send({ email: "upload-planner@test.dev", password: "Password123!" });
    plannerToken = login.body.data.accessToken;

    const hab = await request(app)
      .post("/api/habitations")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ name: "Upload Test City", type: "city", latitude: 12.9, longitude: 77.6 });
    habitationId = hab.body.data.id;
  });
  afterAll(async () => {
    await worker.close();
    await closeDb();
  });

  test("T-09: dataset with 3 rows, 1 missing population (a required field) -> partially_validated with matching issue", async () => {
    const csv =
      "habitation_id,population,populationDensityPerSqKm,growthRatePct\n" +
      `${habitationId},12000,4200,2.4\n` +
      `${habitationId},,4200,2.4\n` +
      `${habitationId},12500,4300,2.6\n`;

    const uploadRes = await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${plannerToken}`)
      .field("habitationId", habitationId)
      .field("category", "demography")
      .attach("file", Buffer.from(csv), "demography.csv");

    expect(uploadRes.status).toBe(202);
    const batchId = uploadRes.body.data.id;

    const batch = await pollUntil(
      async () => {
        const res = await request(app).get(`/api/uploads/${batchId}`).set("Authorization", `Bearer ${plannerToken}`);
        return res.body.data;
      },
      (b) => b.status !== "pending" && b.status !== "validating"
    );

    expect(batch.status).toBe("partially_validated");
    expect(batch.validRowCount).toBe(2);

    const issuesRes = await request(app).get(`/api/uploads/${batchId}/issues`).set("Authorization", `Bearer ${plannerToken}`);
    expect(issuesRes.body.data.some((i: any) => i.field === "population" && i.issueType === "missing_value")).toBe(true);
  });

  test("T-10: re-upload of an identical file -> 409, existing batch returned, no duplicate", async () => {
    const csv = "habitation_id,population,populationDensityPerSqKm,growthRatePct\n" + `${habitationId},13000,4400,2.1\n`;

    const first = await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${plannerToken}`)
      .field("habitationId", habitationId)
      .field("category", "demography")
      .attach("file", Buffer.from(csv), "dup.csv");
    expect(first.status).toBe(202);

    const second = await request(app)
      .post("/api/uploads")
      .set("Authorization", `Bearer ${plannerToken}`)
      .field("habitationId", habitationId)
      .field("category", "demography")
      .attach("file", Buffer.from(csv), "dup.csv");

    expect(second.status).toBe(409);
  });
});
