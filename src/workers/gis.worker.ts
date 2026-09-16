import { Worker, Job } from "bullmq";
import * as shapefile from "shapefile";
import { redisConnection } from "../config/redis";
import { query } from "../config/db";
import { storage } from "../utils/storage";
import { GisJobData } from "./queues";

async function extractGeometries(sourceUrl: string): Promise<any[]> {
  const buffer = await storage.read(sourceUrl);

  if (sourceUrl.match(/\.(geojson|json)$/i) || looksLikeJson(buffer)) {
    const parsed = JSON.parse(buffer.toString("utf-8"));
    if (parsed.type === "FeatureCollection") return parsed.features.map((f: any) => f.geometry).filter(Boolean);
    if (parsed.type === "Feature") return [parsed.geometry];
    return [parsed]; // a bare geometry object
  }

  // .shp / .zip — read via the pure-JS `shapefile` package
  const geometries: any[] = [];
  const source = await shapefile.open(buffer);
  let result = await source.read();
  while (!result.done) {
    if (result.value?.geometry) geometries.push(result.value.geometry);
    result = await source.read();
  }
  return geometries;
}

function looksLikeJson(buffer: Buffer): boolean {
  const first = buffer.toString("utf-8", 0, 1).trim();
  return first === "{" || first === "[";
}

async function processJob(job: Job<GisJobData>) {
  const { mapLayerId } = job.data;
  const layerResult = await query(`SELECT * FROM map_layers WHERE id = $1`, [mapLayerId]);
  const layer = layerResult.rows[0];
  if (!layer) return; // layer was deleted before the job ran

  try {
    const geometries = await extractGeometries(layer.source_file_url);
    if (geometries.length === 0) throw new Error("No geometry found in the uploaded file");

    const geojson = geometries.length === 1
      ? geometries[0]
      : { type: "GeometryCollection", geometries };

    await query(
      `UPDATE map_layers
       SET geometry = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), status = 'ready', failure_reason = NULL
       WHERE id = $1`,
      [mapLayerId, JSON.stringify(geojson)]
    );
  } catch (err: any) {
    await query(
      `UPDATE map_layers SET status = 'failed', failure_reason = $2 WHERE id = $1`,
      [mapLayerId, String(err.message || err)]
    );
    throw err; // let BullMQ record the failure / retry per the queue's attempts option
  }
}

export function startGisWorker() {
  const worker = new Worker<GisJobData>("gis-processing", processJob, { connection: redisConnection });
  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`GIS job ${job?.id} failed:`, err.message);
  });
  return worker;
}
