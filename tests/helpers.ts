import { createApp } from "../src/app";
import { pool } from "../src/config/db";
import { hashPassword } from "../src/utils/password";
import { closeQueues } from "../src/workers/queues";

export const app = createApp();

export interface TestUser { id: string; email: string; role: string; }

export async function createTestUser(email: string, role: "admin" | "planner" | "researcher"): Promise<TestUser> {
  const passwordHash = await hashPassword("Password123!");
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
     RETURNING id, email, role`,
    [email, email, passwordHash, role]
  );
  return result.rows[0];
}

export async function closeDb() {
  await Promise.all([pool.end(), closeQueues()]);
}

/** Polls `fn` until it returns a truthy value or the timeout elapses. */
export async function pollUntil<T>(fn: () => Promise<T>, isReady: (v: T) => boolean, timeoutMs = 8000, intervalMs = 250): Promise<T> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await fn();
    if (isReady(value)) return value;
    if (Date.now() - start > timeoutMs) return value; // return the last value; assertions will show what it actually was
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
