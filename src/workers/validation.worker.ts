import { Worker, Job } from "bullmq";
import { parse } from "csv-parse/sync";
import { ZodError } from "zod";
import { redisConnection } from "../config/redis";
import { query, withTransaction } from "../config/db";
import { storage } from "../utils/storage";
import { CATEGORY_SCHEMAS, CategoryName } from "../modules/parameters/parameter.categories";
import { ValidationJobData } from "./queues";

/** Best-effort string -> typed value coercion for CSV cells before schema validation. */
function coerceCell(value: string): unknown {
  if (value === "" || value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function coerceRow(row: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const coerced = coerceCell(v);
    if (coerced !== undefined) out[k] = coerced;
  }
  return out;
}

function zodIssueToType(issue: { code: string }): "missing_value" | "invalid_range" | "invalid_format" {
  if (issue.code === "invalid_type") return "missing_value";
  if (issue.code === "too_small" || issue.code === "too_big") return "invalid_range";
  return "invalid_format";
}

async function processJob(job: Job<ValidationJobData>) {
  const { batchId } = job.data;
  const batchResult = await query(`SELECT * FROM upload_batches WHERE id = $1`, [batchId]);
  const batch = batchResult.rows[0];
  if (!batch || batch.is_deleted) return;

  // ERR-05: Re-check parent habitation is_deleted before processing
  const habCheck = await query(`SELECT is_deleted FROM habitations WHERE id = $1`, [batch.habitation_id]);
  if (!habCheck.rows[0] || habCheck.rows[0].is_deleted) {
    // eslint-disable-next-line no-console
    console.log(`[discarded_orphaned_job] Parent habitation for batch ${batchId} was soft-deleted mid-run.`);
    return;
  }

  await query(`UPDATE upload_batches SET status = 'validating' WHERE id = $1`, [batchId]);

  try {
    const buffer = await storage.read(batch.source_file_url);
    const records: Record<string, string>[] = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });

    const category = batch.category as CategoryName;
    const schema = CATEGORY_SCHEMAS[category];
    if (!schema) throw new Error(`Unknown category "${batch.category}"`);

    let validRowCount = 0;
    const issueRows: { row: number; field: string | null; type: string; message: string }[] = [];

    records.forEach((record, index) => {
      const rowNumber = index + 1; // 1-indexed, matches Section 4 validation_issues.row_number
      if (!record.habitation_id || !/^[0-9a-f-]{36}$/i.test(record.habitation_id)) {
        issueRows.push({ row: rowNumber, field: "habitation_id", type: "invalid_format", message: `Row ${rowNumber} has a missing or malformed habitation_id.` });
        return;
      }
      const { habitation_id, ...rest } = record;
      const coerced = coerceRow(rest);
      const parsed = schema.safeParse(coerced);

      if (!parsed.success) {
        (parsed.error as ZodError).issues.forEach((issue) => {
          const field = issue.path.join(".") || null;
          issueRows.push({
            row: rowNumber,
            field,
            type: zodIssueToType(issue),
            message: `Row ${rowNumber}: ${field ? `"${field}" — ` : ""}${issue.message}`
          });
        });
      } else {
        validRowCount += 1;
      }
    });

    await withTransaction(async (client) => {
      for (const issue of issueRows) {
        await client.query(
          `INSERT INTO validation_issues (batch_id, row_number, field_name, issue_type, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [batchId, issue.row, issue.field, issue.type, issue.message]
        );
      }
      const status = issueRows.length === 0 ? "validated" : validRowCount > 0 ? "partially_validated" : "failed"; // BR-06
      await client.query(
        `UPDATE upload_batches SET status = $2, row_count = $3, valid_row_count = $4 WHERE id = $1`,
        [batchId, status, records.length, validRowCount]
      );
    });
  } catch (err: any) {
    await query(`UPDATE upload_batches SET status = 'failed' WHERE id = $1`, [batchId]);
    throw err;
  }
}

export function startValidationWorker() {
  const worker = new Worker<ValidationJobData>("dataset-validation", processJob, { connection: redisConnection });
  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`Validation job ${job?.id} failed:`, err.message);
  });
  return worker;
}
