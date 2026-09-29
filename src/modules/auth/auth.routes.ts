import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { rateLimit } from "../../middleware/rateLimit";
import { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from "./auth.schema";
import { register, login, refresh, forgotPassword, reset, me } from "./auth.controller";

const router = Router();
const authLimiter = rateLimit("auth", 10, 60_000); // 10 req/min per IP, per Section 7

router.post("/register", authLimiter, validate(registerSchema), register);       // API-01
router.post("/login", authLimiter, validate(loginSchema), login);                // API-02
router.post("/refresh", authLimiter, validate(refreshSchema), refresh);          // API-03
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), reset);
router.get("/me", requireAuth, me);

export default router;
