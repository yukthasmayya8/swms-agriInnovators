import crypto from "crypto";
import { query } from "../../config/db";
import { storage } from "../../utils/storage";
import { ApiError } from "../../utils/ApiError";
import { validationQueue } from "../../workers/queues";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per API-15 contract

export async function createUploadBatch(
  habitationId: string,
  category: string,
  file: { originalname: string; buffer: Buffer; size: number },
  uploadedBy: string
) {
  const habCheck = await query(`SELECT id FROM habitations WHERE id = $1 AND is_deleted = false`, [habitationId]);
  if (!habCheck.rows[0]) throw ApiError.notFound("Habitation does not exist");

  if (file.size > MAX_SIZE_BYTES) throw ApiError.tooLarge();
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw ApiError.badRequest(`Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`); // BR-05
  }

  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // BR-07: identical (habitation, category, checksum) -> return the existing batch, 200/409, no reprocessing
  const existing = await query(
    `SELECT * FROM upload_batches WHERE habitation_id = $1 AND category = $2 AND file_checksum = $3 AND is_deleted = false`,
    [habitationId, category, checksum]
  );
  if (existing.rows[0]) {
    return { ...existing.rows[0], isExisting: true };
  }

  const key = `uploads/${habitationId}/${crypto.randomUUID()}${ext}`;
  const sourceUrl = await storage.save(key, file.buffer);

  const result = await query(
    `INSERT INTO upload_batches (habitation_id, category, original_filename, source_file_url, file_checksum, status, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
    [habitationId, category, file.originalname, sourceUrl, checksum, uploadedBy]
  );
  const batch = result.rows[0];

  await validationQueue.add(
    "validate",
    { batchId: batch.id },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
  );

  return batch;
}

export async function getUploadBatchOr404(id: string) {
  const result = await query(
    `SELECT ub.* FROM upload_batches ub
     JOIN habitations h ON h.id = ub.habitation_id
     WHERE ub.id = $1 AND ub.is_deleted = false AND h.is_deleted = false`,
    [id]
  );
  if (!result.rows[0]) throw ApiError.notFound("Upload batch does not exist");
  return result.rows[0];
}

export async function getValidationIssues(batchId: string, issueType?: string) {
  await getUploadBatchOr404(batchId); // ensures 404 if soft-deleted
  const params: any[] = [batchId];
  let sql = `SELECT id, row_number, field_name, issue_type, message, resolved_at, resolution FROM validation_issues WHERE batch_id = $1`;
  if (issueType) {
    params.push(issueType);
    sql += ` AND issue_type = $2`;
  }
  sql += ` ORDER BY row_number ASC`;
  let result;
  try {
    result = await query(sql, params);
  } catch (error: any) {
    if (error?.code !== "42703") throw error;
    let legacySql = `SELECT id, row_number, field_name, issue_type, message FROM validation_issues WHERE batch_id = $1`;
    if (issueType) legacySql += " AND issue_type = $2";
    legacySql += " ORDER BY row_number ASC";
    result = await query(legacySql, params);
  }
  return result.rows;
}

export async function resolveValidationIssue(issueId: string, batchId: string, resolution: string, userId: string) {
  const result = await query(
    `UPDATE validation_issues SET resolution = $3, resolved_at = now(), resolved_by = $4 WHERE id = $1 AND batch_id = $2 RETURNING id, row_number, field_name, issue_type, message, resolved_at, resolution`,
    [issueId, batchId, resolution, userId]
  );
  if (!result.rows[0]) throw ApiError.notFound("Validation issue does not exist");
  return result.rows[0];
}

export async function listUploadBatches(userMunicipality?: string, habitationId?: string) {
  const params: string[] = [];
  const filters = ["ub.is_deleted = false", "h.is_deleted = false"];
  if (userMunicipality && userMunicipality !== "All") { params.push(userMunicipality); filters.push(`h.municipality = $${params.length}`); }
  if (habitationId) { params.push(habitationId); filters.push(`ub.habitation_id = $${params.length}`); }
  const result = await query(
    `SELECT ub.id, ub.habitation_id, h.name AS habitation_name, ub.category, ub.original_filename, ub.status, ub.row_count, ub.valid_row_count, ub.uploaded_at
     FROM upload_batches ub JOIN habitations h ON h.id = ub.habitation_id WHERE ${filters.join(" AND ")} ORDER BY ub.uploaded_at DESC LIMIT 50`,
    params
  );
  return result.rows;
}

export function generateCsvTemplate(category: string): { filename: string; content: string } {
  const templates: Record<string, { headers: string[]; sample: string[] }> = {
    demography: {
      headers: ["habitation_id", "population", "populationDensityPerSqKm", "growthRatePct", "floatingPopPct", "householdSize", "literacyPct"],
      sample: ["PASTE-WARD-UUID-HERE", "28460", "5180", "1.84", "6.8", "3.7", "91.6"]
    },
    infrastructure: {
      headers: ["habitation_id", "roadCoveragePct", "roadsAlleysCount", "residentialZonePct", "industrialZonePct", "schoolsCount", "clinicsCount", "collectionVehicles", "collectionPointDensityPct", "existingLandfillCapacityTonnes"],
      sample: ["PASTE-WARD-UUID-HERE", "82", "146", "68", "3", "18", "11", "12", "88", "18400"]
    },
    industrial: {
      headers: ["habitation_id", "hasOrganizedIndustry", "hasUnorganizedIndustry", "industrialActivityIntensity", "industrialWasteTonnesPerDay", "hazardousSharePct"],
      sample: ["PASTE-WARD-UUID-HERE", "false", "true", "low", "1.8", "1.2"]
    },
    natural_resource: {
      headers: ["habitation_id", "annualRainfallMm", "waterBodiesCount", "forestCoverPct", "sensitiveAreaNearby"],
      sample: ["PASTE-WARD-UUID-HERE", "3940", "5", "12", "true"]
    },
    terrain: {
      headers: ["habitation_id", "slope", "soilType", "windCondition", "accessibility", "floodProne"],
      sample: ["PASTE-WARD-UUID-HERE", "flat", "impermeable", "moderate", "good", "true"]
    },
    economic: {
      headers: ["habitation_id", "perCapitaIncomeAnnual", "annualBudgetInr", "willingnessToPayPct", "costConstraintLevel"],
      sample: ["PASTE-WARD-UUID-HERE", "214000", "18200000", "68", "low"]
    },
    cultural: {
      headers: ["habitation_id", "dietType", "segregationAdherencePct", "festivalSpikePct", "localPracticeNotes"],
      sample: ["PASTE-WARD-UUID-HERE", "mixed", "61", "28", "Daily market waste and monsoon surge"]
    }
  };

  const key = category.toLowerCase().replace(/[^a-z_]/g, "");
  const tmpl = templates[key] || templates.demography;
  const content = [tmpl.headers.join(","), tmpl.sample.join(",")].join("\n");
  return {
    filename: `swms_${key}_template.csv`,
    content
  };
}
