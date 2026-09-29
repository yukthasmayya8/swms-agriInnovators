import { createApp } from "./app";
import { env } from "./config/env";
import { startValidationWorker } from "./workers/validation.worker";
import { startGisWorker } from "./workers/gis.worker";

const app = createApp();

app.listen(env.port, () => {
  startValidationWorker();
  startGisWorker();
  // eslint-disable-next-line no-console
  console.log(`SWMS backend API listening on port ${env.port} (${env.nodeEnv})`);
});
