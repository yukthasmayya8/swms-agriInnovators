import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { validate } from "../../middleware/validate";
import { createHabitationSchema, updateHabitationSchema, habitationIdParamSchema } from "./habitation.schema";
import * as controller from "./habitation.controller";
import parameterRoutes from "../parameters/parameter.routes";
import mapLayerRoutes from "../mapLayers/mapLayer.routes";

const router = Router();

router.use(requireAuth); // every habitation route requires authentication

router.get("/", controller.list);                                                          // API-04
router.post("/", requireRole("admin", "planner"), validate(createHabitationSchema), controller.create); // API-05
router.get("/:id", validate(habitationIdParamSchema, "params"), controller.getOne);         // API-06
router.patch("/:id", requireRole("admin", "planner"), validate(habitationIdParamSchema, "params"), validate(updateHabitationSchema), controller.update); // API-07
router.put("/:id", requireRole("admin", "planner"), validate(habitationIdParamSchema, "params"), validate(updateHabitationSchema), controller.update);   // API-07 alias
router.delete("/:id", requireRole("admin"), validate(habitationIdParamSchema, "params"), controller.remove); // API-08

// Nested resources — every map layer / parameter category belongs to a habitation (BR-04)
router.use("/:id/parameters", validate(habitationIdParamSchema, "params"), parameterRoutes);
router.use("/:id/map-layers", validate(habitationIdParamSchema, "params"), mapLayerRoutes);

export default router;
