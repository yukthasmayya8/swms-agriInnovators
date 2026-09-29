import { Router } from "express";
import { upload } from "../../middleware/upload";
import * as controller from "./mapLayer.controller";

const router = Router({ mergeParams: true });

router.post("/", upload.single("file"), controller.upload); // API-12
router.get("/", controller.list);                            // API-13

export default router;
