import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface GisJobData {
  mapLayerId: string;
}
export interface ValidationJobData {
  batchId: string;
}

export const gisQueue = new Queue<GisJobData>("gis-processing", { connection: redisConnection });
export const validationQueue = new Queue<ValidationJobData>("dataset-validation", { connection: redisConnection });
