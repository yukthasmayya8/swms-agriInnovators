import { ensureSecrets } from "../../src/config/secrets";
import { runJob, verifyJobSignature, type JobMessage } from "../../src/workers/queues";

// Replaces the BullMQ worker process on Netlify: the API dispatches GIS
// processing and dataset validation jobs here, and they run in the background
// (up to 15 minutes) after the upload request has already returned.
export default async (req: Request) => {
  await ensureSecrets();
  const body = await req.text();
  if (!verifyJobSignature(body, req.headers.get("x-swms-job-signature"))) {
    console.error("Rejected background job with an invalid signature");
    return;
  }

  const message = JSON.parse(body) as JobMessage;
  if (message.type !== "gis" && message.type !== "validation") {
    console.error(`Unknown background job type: ${(message as any).type}`);
    return;
  }
  await runJob(message);
};
