import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import * as controller from "./mapLayer.controller";

const router = Router();

router.delete("/:id", requireAuth, requireRole("admin", "planner"), controller.remove); // API-14

export default router;
