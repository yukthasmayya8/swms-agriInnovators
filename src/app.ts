import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/auth/user.routes";
import habitationRoutes from "./modules/habitations/habitation.routes";
import mapLayerTopLevelRoutes from "./modules/mapLayers/mapLayerTopLevel.routes";
import uploadRoutes from "./modules/uploads/upload.routes";
import dataRecordRoutes from "./modules/dataRecords/dataRecord.routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);                     // API-18
  app.use("/api/habitations", habitationRoutes);          // also mounts nested /parameters and /map-layers
  app.use("/api/map-layers", mapLayerTopLevelRoutes);       // API-14
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/data-records", dataRecordRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
