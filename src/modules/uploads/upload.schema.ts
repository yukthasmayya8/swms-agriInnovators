import { z } from "zod";
import { CATEGORY_NAMES } from "../parameters/parameter.categories";

export const createUploadSchema = z.object({
  habitationId: z.string().uuid(),
  category: z.enum(CATEGORY_NAMES as [string, ...string[]])
});

export const issuesQuerySchema = z.object({
  issueType: z.enum(["missing_value", "invalid_range", "invalid_format", "duplicate"]).optional()
});
