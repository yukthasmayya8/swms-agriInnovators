import request from "supertest";
import { app, createTestUser, closeDb } from "./helpers";

describe("Auth (REQ-01)", () => {
  beforeAll(async () => {
    await createTestUser("auth-admin@test.dev", "admin");
    await createTestUser("auth-planner@test.dev", "planner");
    await createTestUser("auth-researcher@test.dev", "researcher");
  });
  afterAll(closeDb);

  test("T-01: valid login credentials -> 200, tokens issued", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "auth-planner@test.dev", password: "Password123!" });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  test("T-02: invalid password -> 401, no token issued", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "auth-planner@test.dev", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.data).toBeUndefined();
  });

  test("T-03: Researcher calling PATCH /habitations/{id} is rejected before any DB write", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: "auth-researcher@test.dev", password: "Password123!" });
    const token = login.body.data.accessToken;

    // A fake id is fine here: RBAC must reject before the handler ever looks up the resource.
    const res = await request(app)
      .patch("/api/habitations/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should not be allowed" });

    expect(res.status).toBe(403);
  });

  test("unauthenticated request to a protected route -> 401", async () => {
    const res = await request(app).get("/api/habitations");
    expect(res.status).toBe(401);
  });

  test("manual data records require authentication and planner/admin write access", async () => {
    const unauthenticated = await request(app).get("/api/data-records");
    expect(unauthenticated.status).toBe(401);

    const researcherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "auth-researcher@test.dev", password: "Password123!" });
    const researcherWrite = await request(app)
      .post("/api/data-records")
      .set("Authorization", `Bearer ${researcherLogin.body.data.accessToken}`)
      .send({ habitation: "Test", location: "Karnataka", population: 10, growthRate: 1, rainfallMm: 100, wasteTonnesPerDay: 1, collectionEfficiency: 80, treatmentEfficiency: 60 });
    expect(researcherWrite.status).toBe(403);
  });

  test("new inactive researcher can sign in for basic read-only access", async () => {
    const email = `pending-${Date.now()}@test.dev`;
    const registered = await request(app)
      .post("/api/auth/register")
      .send({ name: "Pending Researcher", email, password: "Password123!" });
    expect(registered.status).toBe(201);
    expect(registered.body.data.isActive).toBe(false);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Password123!" });
    expect(login.status).toBe(200);
    expect(login.body.data.user.isActive).toBe(false);

    const basicRead = await request(app)
      .get("/api/habitations")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(basicRead.status).toBe(200);
  });

  test("only admins can list pending account approvals", async () => {
    const email = `approval-${Date.now()}@test.dev`;
    await request(app).post("/api/auth/register").send({ name: "Approval Request", email, password: "Password123!" });

    const adminLogin = await request(app).post("/api/auth/login").send({ email: "auth-admin@test.dev", password: "Password123!" });
    const adminResponse = await request(app)
      .get("/api/users/pending")
      .set("Authorization", `Bearer ${adminLogin.body.data.accessToken}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.some((user: any) => user.email === email && user.isActive === false)).toBe(true);

    const plannerLogin = await request(app).post("/api/auth/login").send({ email: "auth-planner@test.dev", password: "Password123!" });
    const plannerResponse = await request(app)
      .get("/api/users/pending")
      .set("Authorization", `Bearer ${plannerLogin.body.data.accessToken}`);
    expect(plannerResponse.status).toBe(403);
  });
});
