import { z } from "zod";

export const createHabitationSchema = z.object({
  name: z.string().min(2).max(160),
  type: z.enum(["village", "ward", "town", "city"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export const updateHabitationSchema = createHabitationSchema.partial();

export const habitationIdParamSchema = z.object({
  id: z.string().uuid()
});
