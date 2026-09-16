import request from "supertest";
import { app, createTestUser, closeDb } from "./helpers";

describe("Auth (REQ-01)", () => {
  beforeAll(async () => {
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
});
