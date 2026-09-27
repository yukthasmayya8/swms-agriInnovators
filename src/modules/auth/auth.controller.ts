import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { registerUser, loginUser, refreshAccessToken, activateUser, listPendingUsers } from "./auth.service";

export const pendingUsers = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listPendingUsers() });
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
