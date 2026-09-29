import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type Role = "admin" | "planner" | "researcher";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  municipality?: string;
  isActive: boolean;
  type: "access";
}
export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  jti: string; // unique id for this refresh token, so it can be rotated/deny-listed
}

export function signAccessToken(userId: string, role: Role, isActive = true, municipality = "All"): string {
  const payload: AccessTokenPayload = { sub: userId, role, municipality, isActive, type: "access" };
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn } as jwt.SignOptions);
}

export function signRefreshToken(userId: string, jti: string): string {
  const payload: RefreshTokenPayload = { sub: userId, type: "refresh", jti };
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
}
