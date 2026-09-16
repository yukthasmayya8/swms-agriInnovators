import crypto from "crypto";
import { query } from "../../config/db";
import { storage } from "../../utils/storage";
import { ApiError } from "../../utils/ApiError";
import { gisQueue } from "../../workers/queues";

const ALLOWED_EXTENSIONS = [".geojson", ".json", ".shp", ".zip"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB, per API-12 contract

export async function createMapLayer(
  habitationId: string,
  layerType: string,
  file: { originalname: string; buffer: Buffer; size: number },
  uploadedBy: string
) {
  if (file.size > MAX_SIZE_BYTES) throw ApiError.tooLarge();
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw ApiError.badRequest(`Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  const key = `map-layers/${habitationId}/${crypto.randomUUID()}${ext}`;
  const sourceUrl = await storage.save(key, file.buffer);

  const result = await query(
    `INSERT INTO map_layers (habitation_id, layer_type, source_file_url, status, uploaded_by)
     VALUES ($1, $2, $3, 'processing', $4) RETURNING *`,
    [habitationId, layerType, sourceUrl, uploadedBy]
  );
  const mapLayer = result.rows[0];

  await gisQueue.add("normalize", { mapLayerId: mapLayer.id }, { attempts: 2, backoff: { type: "exponential", delay: 2000 } });

  return mapLayer;
}

export async function listMapLayers(habitationId: string, layerType?: string) {
  const params: any[] = [habitationId];
  let sql = `SELECT id, habitation_id, layer_type, status, failure_reason, uploaded_at,
                    ST_AsGeoJSON(geometry) AS geometry_geojson
             FROM map_layers WHERE habitation_id = $1 AND is_deleted = false`;
  if (layerType) {
    params.push(layerType);
    sql += ` AND layer_type = $2`;
  }
  sql += ` ORDER BY uploaded_at DESC`;
  const result = await query(sql, params);
  return result.rows;
}

/** Combines every "ready" layer for a habitation into one FeatureCollection (Workflow 3, lower path). */
export async function getOverlay(habitationId: string, layerType?: string) {
  const layers = await listMapLayers(habitationId, layerType);
  const ready = layers.filter((l: any) => l.status === "ready" && l.geometry_geojson);
  const processing = layers.filter((l: any) => l.status === "processing").map((l: any) => l.id);

  const features = ready.map((l: any) => ({
    type: "Feature",
    properties: { id: l.id, layerType: l.layer_type },
    geometry: JSON.parse(l.geometry_geojson)
  }));

  return {
    type: "FeatureCollection",
    features,
    processingLayerIds: processing
  };
}

export async function deleteMapLayer(id: string): Promise<void> {
  const result = await query(
    `UPDATE map_layers SET is_deleted = true, deleted_at = now() WHERE id = $1 AND is_deleted = false`,
    [id]
  );
  if (result.rowCount === 0) throw ApiError.notFound("Map layer does not exist");
}

export async function getMapLayerOr404(id: string) {
  const result = await query(`SELECT * FROM map_layers WHERE id = $1 AND is_deleted = false`, [id]);
  if (!result.rows[0]) throw ApiError.notFound("Map layer does not exist");
  return result.rows[0];
}
