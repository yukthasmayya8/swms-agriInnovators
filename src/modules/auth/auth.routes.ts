import { Router } from "express";
import { validate } from "../../middleware/validate";
import { rateLimit } from "../../middleware/rateLimit";
import { registerSchema, loginSchema, refreshSchema } from "./auth.schema";
import { register, login, refresh } from "./auth.controller";

const router = Router();
const authLimiter = rateLimit("auth", 10, 60_000); // 10 req/min per IP, per Section 7

router.post("/register", authLimiter, validate(registerSchema), register);       // API-01
router.post("/login", authLimiter, validate(loginSchema), login);                // API-02
router.post("/refresh", authLimiter, validate(refreshSchema), refresh);          // API-03

export default router;
