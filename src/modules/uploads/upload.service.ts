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
  let sql = `SELECT row_number, field_name, issue_type, message FROM validation_issues WHERE batch_id = $1`;
  if (issueType) {
    params.push(issueType);
    sql += ` AND issue_type = $2`;
  }
  sql += ` ORDER BY row_number ASC`;
  const result = await query(sql, params);
  return result.rows;
}
