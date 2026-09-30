import IORedis from "ioredis";
import { env } from "./env";

let connection: IORedis | null = null;

/** Redis is optional — only used when REDIS_URL is set (self-hosted BullMQ workers). */
export function getRedisConnection(): IORedis {
  if (!env.redisUrl) throw new Error("REDIS_URL is not set; BullMQ workers are unavailable");
  // BullMQ requires this exact option on the connection it's given.
  if (!connection) connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) await connection.quit();
  connection = null;
}
