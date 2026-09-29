import crypto from "crypto";
import { query, withTransaction } from "../../config/db";
import { hashPassword, comparePassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken, Role } from "../../utils/jwt";
import { ApiError } from "../../utils/ApiError";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  municipality: string;
  isActive: boolean;
}

function toPublicUser(row: any): PublicUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role, municipality: row.municipality || "All", isActive: row.is_active };
}

export async function registerUser(input: { name: string; email: string; password: string; role?: Role; municipality?: string; isActive?: boolean }) {
  const passwordHash = await hashPassword(input.password);
  const role = input.role && input.isActive !== undefined ? input.role : "researcher";
  const municipality = input.municipality || "Udupi Municipality";
  const isActive = input.isActive !== undefined ? input.isActive : false;

  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, municipality, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, role, municipality, is_active`,
    [input.name, input.email, passwordHash, role, municipality, isActive]
  );
  return toPublicUser(result.rows[0]);
}

export async function loginUser(email: string, password: string) {
  const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);
  const row = result.rows[0];
  if (!row) throw ApiError.unauthorized("Invalid email or password");
  const valid = await comparePassword(password, row.password_hash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const accessToken = signAccessToken(row.id, row.role, row.is_active, row.municipality || "All");
  const refreshToken = signRefreshToken(row.id, crypto.randomUUID());
  return { accessToken, refreshToken, user: toPublicUser(row) };
}

export async function requestPasswordReset(email: string) {
  const result = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (!result.rows[0]) return { resetToken: null };

  const resetToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  await query(`UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [result.rows[0].id]);
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 minutes')`,
    [result.rows[0].id, tokenHash]
  );
  return { resetToken };
}

export async function resetPassword(email: string, resetToken: string, password: string) {
  const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  const passwordHash = await hashPassword(password);
  await withTransaction(async (client) => {
    const tokenResult = await client.query(
      `SELECT prt.id, prt.user_id FROM password_reset_tokens prt JOIN users u ON u.id = prt.user_id WHERE u.email = $1 AND prt.token_hash = $2 AND prt.used_at IS NULL AND prt.expires_at > now() FOR UPDATE`,
      [email, tokenHash]
    );
    if (!tokenResult.rows[0]) throw ApiError.badRequest("Reset token is invalid or expired");
    await client.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [passwordHash, tokenResult.rows[0].user_id]);
    await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [tokenResult.rows[0].id]);
  });
}

export async function activateUser(userId: string, patch: { isActive?: boolean; role?: Role; municipality?: string; password?: string }) {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (patch.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(patch.isActive);
  }
  if (patch.role) {
    fields.push(`role = $${idx++}`);
    values.push(patch.role);
  }
  if (patch.municipality) {
    fields.push(`municipality = $${idx++}`);
    values.push(patch.municipality);
  }
  if (patch.password) {
    const passwordHash = await hashPassword(patch.password);
    fields.push(`password_hash = $${idx++}`);
    values.push(passwordHash);
  }

  if (fields.length === 0) {
    const existing = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (!existing.rows[0]) throw ApiError.notFound("User does not exist");
    return toPublicUser(existing.rows[0]);
  }

  values.push(userId);
  const result = await query(
    `UPDATE users SET ${fields.join(", ")}, updated_at = now() WHERE id = $${idx} RETURNING id, name, email, role, municipality, is_active`,
    values
  );
  if (!result.rows[0]) throw ApiError.notFound("User does not exist");
  return toPublicUser(result.rows[0]);
}

export async function listAllUsers() {
  const result = await query(
    `SELECT id, name, email, role, municipality, is_active, created_at
     FROM users ORDER BY created_at DESC`
  );
  return result.rows.map(toPublicUser);
}

export async function listPendingUsers() {
  const result = await query(
    `SELECT id, name, email, role, municipality, is_active, created_at
     FROM users WHERE is_active = false ORDER BY created_at ASC`
  );
  return result.rows.map(toPublicUser);
}

export async function refreshAccessToken(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Refresh token is invalid or has expired");
  }
  const result = await query(`SELECT * FROM users WHERE id = $1`, [payload.sub]);
  const row = result.rows[0];
  if (!row) throw ApiError.unauthorized("Account no longer exists");

  const accessToken = signAccessToken(row.id, row.role, row.is_active, row.municipality || "All");
  const newRefreshToken = signRefreshToken(row.id, crypto.randomUUID());
  return { accessToken, refreshToken: newRefreshToken };
}
