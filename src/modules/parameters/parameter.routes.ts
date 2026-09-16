import { Router } from "express";
import * as controller from "./parameter.controller";

const router = Router({ mergeParams: true });

router.get("/:category", controller.get);                 // API-09
router.put("/:category", controller.put);                 // API-10
router.get("/:category/history", controller.history);     // API-11

export default router;
