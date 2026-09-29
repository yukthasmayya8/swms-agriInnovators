import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { pendingUsers, allUsers, createUser, activate } from "./auth.controller";
import { activateUserSchema } from "./auth.schema";

const router = Router();

// Admin User Management & Access Control Endpoints
router.get("/pending", requireAuth, requireRole("admin"), pendingUsers);
router.get("/", requireAuth, requireRole("admin"), allUsers);
router.post("/", requireAuth, requireRole("admin"), createUser);
router.patch("/:id/activate", requireAuth, requireRole("admin"), validate(activateUserSchema), activate);
router.patch("/:id", requireAuth, requireRole("admin"), validate(activateUserSchema), activate);

export default router;
