import { z } from "zod";

// camelCase (API) <-> snake_case (DB) — e.g. "populationDensityPerSqKm" -> "population_density_per_sq_km"
export function toSnakeCase(input: string): string {
  return input.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

const pct = () => z.number().min(0).max(100);

export const CATEGORY_SCHEMAS = {
  demography: z.object({
    population: z.number().int().positive(),
    populationDensityPerSqKm: z.number().int().positive(),
    growthRatePct: z.number().min(-5).max(15).default(0),
    floatingPopPct: pct().optional(),
    householdSize: z.number().positive().max(20).optional(),
    literacyPct: pct().optional(),
    expectedVersion: z.number().int().positive().optional()
  }),
  infrastructure: z.object({
    roadCoveragePct: pct().optional(),
    roadsAlleysCount: z.number().int().nonnegative().optional(),
    residentialZonePct: pct().optional(),
    industrialZonePct: pct().optional(),
    schoolsCount: z.number().int().nonnegative().optional(),
    clinicsCount: z.number().int().nonnegative().optional(),
    collectionVehicles: z.number().int().nonnegative().optional(),
    collectionPointDensityPct: pct().optional(),
    existingLandfillCapacityTonnes: z.number().nonnegative().optional(),
    expectedVersion: z.number().int().positive().optional()
  }),
  industrial: z.object({
    hasOrganizedIndustry: z.boolean().optional(),
    hasUnorganizedIndustry: z.boolean().optional(),
    industrialActivityIntensity: z.enum(["low", "medium", "high"]).optional(),
    industrialWasteTonnesPerDay: z.number().nonnegative().optional(),
    hazardousSharePct: pct().optional(),
    expectedVersion: z.number().int().positive().optional()
  }),
  natural_resource: z.object({
    annualRainfallMm: z.number().min(0).max(8000).optional(),
    waterBodiesCount: z.number().int().nonnegative().optional(),
    forestCoverPct: pct().optional(),
    sensitiveAreaNearby: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional()
  }),
  terrain: z.object({
    slope: z.enum(["flat", "moderate", "hilly"]).optional(),
    soilType: z.enum(["permeable", "impermeable"]).optional(),
    windCondition: z.enum(["low", "moderate", "high"]).optional(),
    accessibility: z.enum(["good", "moderate", "poor"]).optional(),
    floodProne: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional()
  }),
  economic: z.object({
    perCapitaIncomeAnnual: z.number().nonnegative().optional(),
    annualBudgetInr: z.number().nonnegative().optional(),
    willingnessToPayPct: pct().optional(),
    costConstraintLevel: z.enum(["low", "medium", "high"]).optional(),
    expectedVersion: z.number().int().positive().optional()
  }),
  cultural: z.object({
    dietType: z.enum(["veg", "nonveg", "mixed"]).optional(),
    segregationAdherencePct: pct().optional(),
    festivalSpikePct: pct().optional(),
    localPracticeNotes: z.string().max(2000).optional(),
    expectedVersion: z.number().int().positive().optional()
  })
} as const;

export type CategoryName = keyof typeof CATEGORY_SCHEMAS;
export const CATEGORY_NAMES = Object.keys(CATEGORY_SCHEMAS) as CategoryName[];

export const CATEGORY_TABLES: Record<CategoryName, string> = {
  demography: "demography_parameters",
  infrastructure: "infrastructure_parameters",
  industrial: "industrial_parameters",
  natural_resource: "natural_resource_parameters",
  terrain: "terrain_parameters",
  economic: "economic_parameters",
  cultural: "cultural_parameters"
};

export function isValidCategory(value: string): value is CategoryName {
  return (CATEGORY_NAMES as string[]).includes(value);
}
