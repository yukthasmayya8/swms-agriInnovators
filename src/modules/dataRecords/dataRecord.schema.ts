import { z } from "zod";

export const dataRecordSchema = z.object({
    habitation: z.string().trim().min(2).max(120),
    location: z.string().trim().min(2).max(180),
    population: z.coerce.number().int().min(1).max(100000000),
    growthRate: z.coerce.number().min(-50).max(50),
    rainfallMm: z.coerce.number().min(0).max(20000),
    wasteTonnesPerDay: z.coerce.number().min(0).max(50000),
    collectionEfficiency: z.coerce.number().min(0).max(100),
    treatmentEfficiency: z.coerce.number().min(0).max(100)
}).strict();

export const updateDataRecordSchema = dataRecordSchema.partial();
