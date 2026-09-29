import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { dataRecordSchema, updateDataRecordSchema } from "./dataRecord.schema";
import * as controller from "./dataRecord.controller";

const router = Router();

router.use(requireAuth);
router.get("/", controller.list);
router.post("/", requireRole("admin", "planner"), validate(dataRecordSchema), controller.create);
router.get("/:id", controller.getOne);
router.put("/:id", requireRole("admin", "planner"), validate(updateDataRecordSchema), controller.update);
router.delete("/:id", requireRole("admin"), controller.remove);

export default router;
