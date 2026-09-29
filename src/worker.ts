import { startGisWorker } from "./workers/gis.worker";
import { startValidationWorker } from "./workers/validation.worker";

startGisWorker();
startValidationWorker();

// eslint-disable-next-line no-console
console.log("SWMS background worker running — listening for gis-processing and dataset-validation jobs");
