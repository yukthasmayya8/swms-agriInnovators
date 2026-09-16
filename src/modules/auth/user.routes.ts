import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { activateUserSchema } from "./auth.schema";
import { activate } from "./auth.controller";

const router = Router();

// API-18: Admin activates a user account and/or updates role
router.patch("/:id/activate", requireAuth, requireRole("admin"), validate(activateUserSchema), activate);

export default router;
