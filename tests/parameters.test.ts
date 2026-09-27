import request from "supertest";
import { app, createTestUser, closeDb } from "./helpers";

describe("Habitation Parameters (REQ-02)", () => {
  let plannerToken: string;
  let otherPlannerToken: string;
  let habitationId: string;

  beforeAll(async () => {
    await createTestUser("param-planner@test.dev", "planner");
    await createTestUser("param-other-planner@test.dev", "planner");

    const login = await request(app).post("/api/auth/login").send({ email: "param-planner@test.dev", password: "Password123!" });
    plannerToken = login.body.data.accessToken;

    const otherLogin = await request(app).post("/api/auth/login").send({ email: "param-other-planner@test.dev", password: "Password123!" });
    otherPlannerToken = otherLogin.body.data.accessToken;

    const hab = await request(app)
      .post("/api/habitations")
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ name: "Param Test Village", type: "village", latitude: 13.1, longitude: 74.8 });
    habitationId = hab.body.data.id;
  });
  afterAll(closeDb);

  test("T-04: valid Demography payload from the owning Planner -> 200, change log created", async () => {
    const res = await request(app)
      .put(`/api/habitations/${habitationId}/parameters/demography`)
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ population: 3000, populationDensityPerSqKm: 800, growthRatePct: 1.8 });

    expect(res.status).toBe(200);
    expect(res.body.data.fieldsChanged).toEqual(expect.arrayContaining(["population", "populationDensityPerSqKm", "growthRatePct"]));

    const history = await request(app)
      .get(`/api/habitations/${habitationId}/parameters/demography/history`)
      .set("Authorization", `Bearer ${plannerToken}`);
    expect(history.body.data.length).toBeGreaterThan(0);
  });

  test("T-05: payload missing a required field -> 400 naming the field", async () => {
    const res = await request(app)
      .put(`/api/habitations/${habitationId}/parameters/demography`)
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ growthRatePct: 2.0 }); // missing required population / populationDensityPerSqKm

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: any) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["population", "populationDensityPerSqKm"]));
  });

  test("T-06: a different Planner editing a habitation they don't own -> 403", async () => {
    const res = await request(app)
      .put(`/api/habitations/${habitationId}/parameters/demography`)
      .set("Authorization", `Bearer ${otherPlannerToken}`)
      .send({ population: 9999, populationDensityPerSqKm: 800 });

    expect(res.status).toBe(403);
  });

  test("T-07: PUT with wrong expectedVersion -> 409 Conflict", async () => {
    const res = await request(app)
      .put(`/api/habitations/${habitationId}/parameters/demography`)
      .set("Authorization", `Bearer ${plannerToken}`)
      .send({ population: 3500, populationDensityPerSqKm: 850, growthRatePct: 2.0, expectedVersion: 999 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});
