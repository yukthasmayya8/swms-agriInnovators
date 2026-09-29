import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(72),
  role: z.enum(["admin", "planner", "researcher"]).default("researcher")
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10)
});

export const forgotPasswordSchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  resetToken: z.string().min(16),
  password: z.string().min(8).max(72)
});

export const activateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "planner", "researcher"]).optional(),
  municipality: z.string().min(1).max(160).optional(),
  password: z.string().min(8).max(72).optional()
});
