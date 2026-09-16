import { z } from "zod";

export const LAYER_TYPES = ["road", "water_body", "terrain", "settlement", "boundary"] as const;

export const uploadMapLayerSchema = z.object({
  layerType: z.enum(LAYER_TYPES)
});

export const overlayQuerySchema = z.object({
  overlay: z.enum(["true", "false"]).optional(),
  layerType: z.enum(LAYER_TYPES).optional()
});
