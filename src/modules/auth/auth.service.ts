import crypto from "crypto";
import { query } from "../../config/db";
import { hashPassword, comparePassword } from "../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken, Role } from "../../utils/jwt";
import { ApiError } from "../../utils/ApiError";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

function toPublicUser(row: any): PublicUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role, isActive: row.is_active };
}

export async function registerUser(input: { name: string; email: string; password: string; role?: Role; isActive?: boolean }) {
  const passwordHash = await hashPassword(input.password);
  // BR-08 / API-01: Public registration creates only Researcher accounts (is_active = false) requiring Admin activation.
  const role = input.role && input.isActive !== undefined ? input.role : "researcher";
  const isActive = input.isActive !== undefined ? input.isActive : false;

  const result = await query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, is_active`,
    [input.name, input.email, passwordHash, role, isActive]
  );
  return toPublicUser(result.rows[0]);
}

export async function loginUser(email: string, password: string) {
  const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);
  const row = result.rows[0];
  if (!row) throw ApiError.unauthorized("Invalid email or password");
  if (!row.is_active) throw ApiError.unauthorized("Account requires admin activation");

  const valid = await comparePassword(password, row.password_hash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const accessToken = signAccessToken(row.id, row.role);
  const refreshToken = signRefreshToken(row.id, crypto.randomUUID());
  return { accessToken, refreshToken, user: toPublicUser(row) };
}

export async function activateUser(userId: string, patch: { isActive?: boolean; role?: Role }) {
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

  if (fields.length === 0) {
    const existing = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (!existing.rows[0]) throw ApiError.notFound("User does not exist");
    return toPublicUser(existing.rows[0]);
  }

  values.push(userId);
  const result = await query(
    `UPDATE users SET ${fields.join(", ")}, updated_at = now() WHERE id = $1 RETURNING id, name, email, role, is_active`,
    values
  );
  if (!result.rows[0]) throw ApiError.notFound("User does not exist");
  return toPublicUser(result.rows[0]);
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
  if (!row || !row.is_active) throw ApiError.unauthorized("Account no longer active");

  // Rotate: issue a brand new refresh token (new jti) alongside the new access token.
  const accessToken = signAccessToken(row.id, row.role);
  const newRefreshToken = signRefreshToken(row.id, crypto.randomUUID());
  return { accessToken, refreshToken: newRefreshToken };
}
