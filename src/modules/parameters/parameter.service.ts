import { PoolClient } from "pg";
import { query, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { CATEGORY_TABLES, CategoryName, toSnakeCase } from "./parameter.categories";

export async function getCategory(habitationId: string, category: CategoryName) {
  const table = CATEGORY_TABLES[category];
  const result = await query(`SELECT * FROM ${table} WHERE habitation_id = $1`, [habitationId]);
  if (!result.rows[0]) throw ApiError.notFound(`No ${category} parameters have been set for this habitation yet`);
  return result.rows[0];
}

/**
 * Upserts one parameter category and writes a parameter_change_log row for
 * every field that actually changed — all inside a single transaction, so a
 * parameter can never be saved without its corresponding history entry (BR-03).
 */
export async function upsertCategory(
  habitationId: string,
  category: CategoryName,
  payload: Record<string, unknown>,
  editorId: string
) {
  const table = CATEGORY_TABLES[category];
  const { expectedVersion, ...paramData } = payload;

  return withTransaction(async (client: PoolClient) => {
    const existingResult = await client.query(`SELECT * FROM ${table} WHERE habitation_id = $1 FOR UPDATE`, [habitationId]);
    const existing = existingResult.rows[0] || null;

    if (existing && expectedVersion !== undefined && Number(expectedVersion) !== Number(existing.version)) {
      throw ApiError.conflict(`Optimistic lock mismatch: expected version ${expectedVersion}, but current version is ${existing.version}`, {
        currentVersion: existing.version
      });
    }

    const columns = Object.keys(paramData).map(toSnakeCase);
    const values = Object.values(paramData);

    let savedRow;
    if (existing) {
      const setClauses = columns.map((c, i) => `${c} = $${i + 2}`).join(", ");
      const newVersion = (existing.version || 1) + 1;
      const updateResult = await client.query(
        `UPDATE ${table} SET ${setClauses}, version = $${columns.length + 2}, updated_at = now(), updated_by = $${columns.length + 3}
         WHERE habitation_id = $1 RETURNING *`,
        [habitationId, ...values, newVersion, editorId]
      );
      savedRow = updateResult.rows[0];
    } else {
      const cols = ["habitation_id", ...columns, "version", "updated_by"];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const insertResult = await client.query(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
        [habitationId, ...values, 1, editorId]
      );
      savedRow = insertResult.rows[0];
    }

    const changedFields: string[] = [];
    for (const [camelField, newValue] of Object.entries(paramData)) {
      const snakeField = toSnakeCase(camelField);
      const oldValue = existing ? existing[snakeField] : null;
      const oldStr = oldValue === null || oldValue === undefined ? null : String(oldValue);
      const newStr = String(newValue);
      if (oldStr === newStr) continue; // no-op field, no history noise

      changedFields.push(camelField);
      await client.query(
        `INSERT INTO parameter_change_log (habitation_id, category, field_name, old_value, new_value, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [habitationId, category, camelField, oldStr, newStr, editorId]
      );
    }

    return {
      habitationId,
      category,
      updatedAt: savedRow.updated_at,
      fieldsChanged: changedFields,
      changedFields,
      version: savedRow.version,
      row: savedRow
    };
  });
}

export async function getCategoryHistory(habitationId: string, category: CategoryName) {
  const result = await query(
    `SELECT field_name, old_value, new_value, changed_by, changed_at
     FROM parameter_change_log
     WHERE habitation_id = $1 AND category = $2
     ORDER BY changed_at DESC`,
    [habitationId, category]
  );
  return result.rows;
}
