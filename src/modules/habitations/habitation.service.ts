import { query, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { Role } from "../../utils/jwt";

export interface HabitationRow {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  owner_id: string;
  is_deleted?: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export async function listHabitations(): Promise<HabitationRow[]> {
  const result = await query(`SELECT * FROM habitations WHERE is_deleted = false ORDER BY created_at DESC`);
  return result.rows;
}

export async function getHabitationOr404(id: string): Promise<HabitationRow> {
  const result = await query(`SELECT * FROM habitations WHERE id = $1 AND is_deleted = false`, [id]);
  if (!result.rows[0]) throw ApiError.notFound("Habitation does not exist");
  return result.rows[0];
}

export async function createHabitation(
  input: { name: string; type: string; latitude: number; longitude: number },
  ownerId: string
): Promise<HabitationRow> {
  const result = await query(
    `INSERT INTO habitations (name, type, latitude, longitude, owner_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.name, input.type, input.latitude, input.longitude, ownerId]
  );
  return result.rows[0];
}

/** BR-02: Admin may edit any habitation; a Planner may only edit habitations they own. */
export function assertCanEditHabitation(habitation: HabitationRow, userId: string, role: Role) {
  if (role === "admin") return;
  if (role === "planner" && habitation.owner_id === userId) return;
  throw ApiError.forbidden("You can only edit habitations you own");
}

export async function updateHabitation(
  id: string,
  patch: Partial<{ name: string; type: string; latitude: number; longitude: number }>
): Promise<HabitationRow> {
  const fields = Object.keys(patch);
  if (fields.length === 0) return getHabitationOr404(id);

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
  const values = fields.map((f) => (patch as any)[f]);
  const result = await query(
    `UPDATE habitations SET ${setClauses}, updated_at = now() WHERE id = $1 AND is_deleted = false RETURNING *`,
    [id, ...values]
  );
  if (!result.rows[0]) throw ApiError.notFound("Habitation does not exist");
  return result.rows[0];
}

/** BR-09 & T-14: Admin soft-deletes a habitation. Blocked (409) if any upload batch is status = 'validating'. */
export async function deleteHabitation(id: string): Promise<void> {
  const hab = await getHabitationOr404(id);

  const activeBatches = await query(
    `SELECT id FROM upload_batches WHERE habitation_id = $1 AND status = 'validating' AND is_deleted = false`,
    [hab.id]
  );
  if (activeBatches.rows.length > 0) {
    throw ApiError.conflict("Cannot delete habitation with an in-flight validating batch");
  }

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE habitations SET is_deleted = true, deleted_at = now() WHERE id = $1`,
      [hab.id]
    );
    await client.query(
      `UPDATE map_layers SET is_deleted = true, deleted_at = now() WHERE habitation_id = $1`,
      [hab.id]
    );
    await client.query(
      `UPDATE upload_batches SET is_deleted = true, deleted_at = now() WHERE habitation_id = $1 AND status != 'validating'`,
      [hab.id]
    );
  });
}
