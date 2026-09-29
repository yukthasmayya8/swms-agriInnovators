import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { query } from "../../config/db";
import { registerUser, loginUser, refreshAccessToken, activateUser, listPendingUsers, listAllUsers, requestPasswordReset, resetPassword } from "./auth.service";

export const pendingUsers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listPendingUsers() });
});

export const allUsers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listAllUsers() });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await registerUser({ ...req.body, isActive: req.body.isActive ?? true });
  res.status(201).json({ success: true, data: user });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await registerUser(req.body);
  res.status(201).json({ success: true, data: user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await loginUser(email, password);
  res.status(200).json({ success: true, data: result });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const result = await query(`SELECT id, name, email, role, municipality, is_active FROM users WHERE id = $1`, [req.user!.id]);
  if (!result.rows[0]) throw new Error("Account no longer exists");
  res.json({ success: true, data: { id: result.rows[0].id, name: result.rows[0].name, email: result.rows[0].email, role: result.rows[0].role, municipality: result.rows[0].municipality, isActive: result.rows[0].is_active } });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await requestPasswordReset(req.body.email);
  res.json({ success: true, data: result });
});

export const reset = asyncHandler(async (req: Request, res: Response) => {
  await resetPassword(req.body.email, req.body.resetToken, req.body.password);
  res.json({ success: true, data: { reset: true } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  const result = await refreshAccessToken(refreshToken);
  res.status(200).json({ success: true, data: result });
});

export const activate = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = await activateUser(id, req.body);
  res.status(200).json({ success: true, data: user });
});
