import { Worker, Job } from "bullmq";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { ZodError } from "zod";
import { redisConnection } from "../config/redis";
import { query, withTransaction } from "../config/db";
import { storage } from "../utils/storage";
import { CATEGORY_SCHEMAS, CATEGORY_TABLES, CategoryName, toSnakeCase } from "../modules/parameters/parameter.categories";
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
    let records: Record<string, string>[];
    if (batch.original_filename.toLowerCase().endsWith(".xlsx")) {
      const workbook = new ExcelJS.Workbook();
      const workbookBytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      await workbook.xlsx.load(workbookBytes);
      const worksheet = workbook.worksheets[0];
      records = [];
      if (worksheet) {
        const headers: string[] = [];
        worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
          headers[column - 1] = cell.text.trim();
        });
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const record: Record<string, string> = {};
          headers.forEach((header, index) => {
            if (header) record[header] = row.getCell(index + 1).text;
          });
          records.push(record);
        });
      }
    } else {
      records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
    }

    const category = batch.category as CategoryName;
    const schema = CATEGORY_SCHEMAS[category];
    if (!schema) throw new Error(`Unknown category "${batch.category}"`);

    let validRowCount = 0;
    const issueRows: { row: number; field: string | null; type: string; message: string }[] = [];
    const validRows: { habitationId: string; data: Record<string, unknown> }[] = [];

    records.forEach((record, index) => {
      const rowNumber = index + 1; // 1-indexed, matches Section 4 validation_issues.row_number
      if (!record.habitation_id || !/^[0-9a-f-]{36}$/i.test(record.habitation_id)) {
        issueRows.push({ row: rowNumber, field: "habitation_id", type: "invalid_format", message: `Row ${rowNumber} has a missing or malformed habitation_id.` });
        return;
      }
      if (record.habitation_id !== batch.habitation_id) {
        issueRows.push({ row: rowNumber, field: "habitation_id", type: "invalid_format", message: `Row ${rowNumber}: habitation_id must match the ward selected for this upload.` });
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
        validRows.push({ habitationId: habitation_id, data: parsed.data });
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
      const table = CATEGORY_TABLES[category];
      for (const validRow of validRows) {
        const entries = Object.entries(validRow.data).filter(([key]) => key !== "expectedVersion");
        if (entries.length === 0) continue;
        const columns = entries.map(([key]) => toSnakeCase(key));
        const values = entries.map(([, value]) => value);
        const insertColumns = ["habitation_id", ...columns, "version", "updated_by"];
        const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(", ");
        const updates = columns.map((column, index) => `${column} = EXCLUDED.${column}`).concat(["version = " + table + ".version + 1", "updated_at = now()", "updated_by = EXCLUDED.updated_by"]);
        await client.query(
          `INSERT INTO ${table} (${insertColumns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (habitation_id) DO UPDATE SET ${updates.join(", ")}`,
          [validRow.habitationId, ...values, 1, batch.uploaded_by]
        );
      }
    });
  } catch (err: any) {
    await query(`UPDATE upload_batches SET status = 'failed' WHERE id = $1`, [batchId]);
    throw err;
  }
}

export function startValidationWorker() {
  const queueName = process.env.NODE_ENV === "test" ? "dataset-validation-test" : "dataset-validation";
  const worker = new Worker<ValidationJobData>(queueName, processJob, { connection: redisConnection });
  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`Validation job ${job?.id} failed:`, err.message);
  });
  return worker;
}
