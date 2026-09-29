import { Router } from "express";
import { simulate, sensitivity, budget, ask } from "./simulation.controller";

const router = Router({ mergeParams: true });
router.get("/", simulate);
router.get("/sensitivity", sensitivity);
router.get("/budget", budget);
router.post("/ask", ask);

export default router;