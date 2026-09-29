import IORedis from "ioredis";
import { env } from "./env";

// BullMQ requires this exact option on the connection it's given.
export const redisConnection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
