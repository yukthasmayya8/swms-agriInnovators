import { Pool, QueryResultRow } from "pg";
import { env } from "./env";

export const pool = new Pool({ connectionString: env.databaseUrl });

pool.on("error", (err: Error) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected PostgreSQL pool error", err);
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  return pool.query<T>(text, params);
}

/** Runs `fn` inside a single transaction, rolling back on any error. */
export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
