import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { uploadMapLayerSchema, overlayQuerySchema } from "./mapLayer.schema";
import * as service from "./mapLayer.service";
import { getHabitationOr404, assertCanEditHabitation } from "../habitations/habitation.service";

export const upload = asyncHandler(async (req: Request, res: Response) => {
  const habitationId = (req.params.id as string);
  const habitation = await getHabitationOr404(habitationId, req.user?.municipality);
  assertCanEditHabitation(habitation, req.user!.id, req.user!.role);

  if (!req.file) throw ApiError.badRequest("No file was uploaded (expected field name \"file\")");
  const parsed = uploadMapLayerSchema.safeParse(req.body);
  if (!parsed.success) throw ApiError.badRequest("layerType is required and must be one of the supported types");

  const mapLayer = await service.createMapLayer(habitationId, parsed.data.layerType, req.file, req.user!.id);
  res.status(201).json({
    success: true,
    data: { id: mapLayer.id, habitationId: mapLayer.habitation_id, layerType: mapLayer.layer_type, status: mapLayer.status }
  });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const habitationId = (req.params.id as string);
  await getHabitationOr404(habitationId, req.user?.municipality);
  const parsed = overlayQuerySchema.safeParse(req.query);
  if (!parsed.success) throw ApiError.badRequest("Invalid query parameters");

  if (parsed.data.overlay === "true") {
    const overlay = await service.getOverlay(habitationId, parsed.data.layerType);
    return res.json({ success: true, data: overlay });
  }
  const layers = await service.listMapLayers(habitationId, parsed.data.layerType);
  res.json({ success: true, data: layers });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const layer = await service.getMapLayerOr404((req.params.id as string));
  const habitation = await getHabitationOr404(layer.habitation_id, req.user?.municipality);
  assertCanEditHabitation(habitation, req.user!.id, req.user!.role);
  await service.deleteMapLayer((req.params.id as string));
  res.status(204).send();
});
