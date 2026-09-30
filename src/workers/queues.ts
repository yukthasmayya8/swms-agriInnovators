import crypto from "crypto";
import { Queue, UnrecoverableError } from "bullmq";
import { env } from "../config/env";
import { getRedisConnection, closeRedisConnection } from "../config/redis";

export interface GisJobData {
  mapLayerId: string;
}
export interface ValidationJobData {
  batchId: string;
}

export type JobMessage =
  | { type: "gis"; data: GisJobData }
  | { type: "validation"; data: ValidationJobData };

const JOB_OPTIONS = {
  gis: { attempts: 2, backoffMs: 2000 },
  validation: { attempts: 3, backoffMs: 2000 }
} as const;

const queueSuffix = process.env.NODE_ENV === "test" ? "-test" : "";

/*
 * Background jobs run in one of two ways:
 *  - REDIS_URL set  -> BullMQ queues consumed by `npm run dev:worker` / src/server.ts (self-hosted).
 *  - otherwise      -> a Netlify Background Function (netlify/functions/jobs-background.mts),
 *                      so no separate worker process is needed.
 */
let gisQueue: Queue<GisJobData> | null = null;
let validationQueue: Queue<ValidationJobData> | null = null;

function getGisQueue() {
  if (!gisQueue) gisQueue = new Queue<GisJobData>(`gis-processing${queueSuffix}`, { connection: getRedisConnection() });
  return gisQueue;
}
function getValidationQueue() {
  if (!validationQueue) validationQueue = new Queue<ValidationJobData>(`dataset-validation${queueSuffix}`, { connection: getRedisConnection() });
  return validationQueue;
}

// Origin of the current deploy, captured from incoming API requests so jobs are
// dispatched to the same deploy (and database branch) that received the upload.
let jobOrigin = "";
export function setJobOrigin(origin: string) {
  jobOrigin = origin;
}

export function signJob(body: string): string {
  return crypto.createHmac("sha256", env.jwt.accessSecret).update(body).digest("hex");
}

export function verifyJobSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signJob(body));
  const received = Buffer.from(signature);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/** Runs a job in-process with the same retry/backoff semantics as the BullMQ queues. */
export async function runJob(message: JobMessage): Promise<void> {
  const { attempts, backoffMs } = JOB_OPTIONS[message.type];
  for (let attempt = 1; ; attempt++) {
    try {
      if (message.type === "gis") {
        const { processGisJob } = await import("./gis.worker");
        await processGisJob(message.data);
      } else {
        const { processValidationJob } = await import("./validation.worker");
        await processValidationJob(message.data);
      }
      return;
    } catch (err: any) {
      if (attempt >= attempts || err instanceof UnrecoverableError) {
        // eslint-disable-next-line no-console
        console.error(`${message.type} job failed after ${attempt} attempt(s):`, err?.message || err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, backoffMs * 2 ** (attempt - 1)));
    }
  }
}

async function dispatch(message: JobMessage): Promise<void> {
  if (env.redisUrl) {
    const { attempts, backoffMs } = JOB_OPTIONS[message.type];
    const opts = { attempts, backoff: { type: "exponential", delay: backoffMs } };
    if (message.type === "gis") await getGisQueue().add("normalize", message.data, opts);
    else await getValidationQueue().add("validate", message.data, opts);
    return;
  }

  if (jobOrigin) {
    const body = JSON.stringify(message);
    const response = await fetch(`${jobOrigin}/.netlify/functions/jobs-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-swms-job-signature": signJob(body) },
      body
    });
    if (response.status === 202) return;
    // eslint-disable-next-line no-console
    console.error(`Background job dispatch failed with status ${response.status}; running inline`);
  }

  // No queue or background function available — process in the current process.
  void runJob(message);
}

export function enqueueGisJob(data: GisJobData) {
  return dispatch({ type: "gis", data });
}

export function enqueueValidationJob(data: ValidationJobData) {
  return dispatch({ type: "validation", data });
}

let closed = false;

export async function closeQueues(): Promise<void> {
  if (closed) return;
  closed = true;
  await Promise.all([gisQueue?.close(), validationQueue?.close()]);
  await closeRedisConnection();
}
