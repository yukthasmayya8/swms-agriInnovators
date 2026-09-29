import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface GisJobData {
  mapLayerId: string;
}
export interface ValidationJobData {
  batchId: string;
}

const queueSuffix = process.env.NODE_ENV === "test" ? "-test" : "";

export const gisQueue = new Queue<GisJobData>(`gis-processing${queueSuffix}`, { connection: redisConnection });
export const validationQueue = new Queue<ValidationJobData>(`dataset-validation${queueSuffix}`, { connection: redisConnection });

let closed = false;

export async function closeQueues(): Promise<void> {
  if (closed) return;
  closed = true;
  await Promise.all([gisQueue.close(), validationQueue.close()]);
  await redisConnection.quit();
}
