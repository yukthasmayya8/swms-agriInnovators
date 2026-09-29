import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { upload as multerUpload } from "../../middleware/upload";
import { rateLimit } from "../../middleware/rateLimit";
import * as controller from "./upload.controller";

const router = Router();
const uploadLimiter = rateLimit("uploads", 5, 60_000); // 5 req/min per IP, per Section 7

router.use(requireAuth);

router.get("/", controller.list);
router.get("/template/:category", controller.downloadTemplate);
router.post("/", uploadLimiter, requireRole("admin", "planner"), multerUpload.single("file"), controller.create); // API-15
router.get("/:id", controller.getOne);       // API-16
router.get("/:id/issues", controller.issues); // API-17
router.patch("/:id/issues/:issueId", controller.resolveIssue);

export default router;
